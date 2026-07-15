import { SupportTicket } from '../../models/supportTicket.model.js';
import { Driver } from '../../models/driver.model.js';
import { getSupportSettings } from '../../models/supportSettings.model.js';
import { uploadOnCloudinary } from '../../utils/cloudinary.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { maybeAppendAiReply, greetAndMaybeAnswer } from '../../utils/supportAi.js';
import { autoAssignTicket } from '../../utils/supportAssign.js';

// Global support capabilities, for the mobile app to show/hide controls.
const getSupportConfig = asyncHandler(async (req, res) => {
    const s = await getSupportSettings();
    return res.status(200).json(new apiResponse(200, {
        voiceMessages: s.voiceMessages,
        documents: s.documents,
        audioCall: s.audioCall,
        videoCall: s.videoCall,
    }, 'Support settings fetched'));
});

const createTicket = asyncHandler(async (req, res) => {
    const { subject, category, message, tripId } = req.body;
    if (!subject || !category || !message) {
        throw new apiError(400, 'Subject, category, and message are required');
    }

    // Link the driver profile (if any) so support sees vehicle details and can verify.
    const driver = await Driver.findOne({ userId: req.user._id }).select('_id');

    const ticket = await SupportTicket.create({
        userId: req.user._id,
        driverId: driver?._id || null,
        subject,
        category,
        tripId: tripId || null,
        messages: [{ senderId: req.user._id, senderType: 'user', message }],
    });

    // AI greets first (welcome + working hours) and tries a KB answer; it goes
    // silent later once a human agent replies. Non-blocking (shows on refetch).
    greetAndMaybeAnswer(ticket, message).catch(() => {});
    // Round-robin auto-assign to a support agent (non-blocking).
    autoAssignTicket(ticket._id).catch(() => {});

    return res.status(201).json(new apiResponse(201, ticket, 'Support ticket created'));
});

const getMyTickets = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const tickets = await SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .populate('assignedTo', 'name role avatarUrl');
    return res.status(200).json(new apiResponse(200, tickets, 'Tickets fetched'));
});

const getTicketById = asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.user._id })
        .populate('assignedTo', 'name role avatarUrl');
    if (!ticket) throw new apiError(404, 'Ticket not found');
    return res.status(200).json(new apiResponse(200, ticket, 'Ticket fetched'));
});

const addMessage = asyncHandler(async (req, res) => {
    const message = (req.body.message || '').trim();
    const hasFile = !!req.file;

    if (!message && !hasFile) throw new apiError(400, 'A message or attachment is required');

    // Global gate: voice notes and documents are independently allowable.
    if (hasFile) {
        const isAudio = (req.file.mimetype || '').startsWith('audio/');
        const settings = await getSupportSettings();
        if (isAudio && !settings.voiceMessages) {
            throw new apiError(403, 'Voice messages are currently disabled.');
        }
        if (!isAudio && !settings.documents) {
            throw new apiError(403, 'Document uploads are currently disabled.');
        }
    }

    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.user._id });
    if (!ticket) throw new apiError(404, 'Ticket not found');

    const entry = { senderId: req.user._id, senderType: 'user', message };

    if (hasFile) {
        const result = await uploadOnCloudinary(req.file.path);
        if (!result?.secure_url) throw new apiError(500, 'Failed to upload attachment');
        entry.attachmentUrl = result.secure_url;
        entry.attachmentType = (req.file.mimetype || '').startsWith('audio/') ? 'audio' : 'file';
        entry.attachmentName = req.file.originalname || null;
    }

    ticket.messages.push(entry);
    // A reply on a resolved/closed thread reopens the ticket for the customer -
    // they don't need to file a fresh one to follow up on the same issue.
    const reopened = ['resolved', 'closed'].includes(ticket.status);
    if (reopened) {
        ticket.status = 'open';
        ticket.resolvedAt = null;
    }
    await ticket.save();

    // Non-blocking AI reply for text messages (not attachment-only), from the KB.
    if (message) maybeAppendAiReply(ticket, message).catch(() => {});
    // A reopened thread with no agent re-enters the assignment rotation.
    if (reopened) autoAssignTicket(ticket._id).catch(() => {});

    return res.status(200).json(new apiResponse(200, ticket, reopened ? 'Ticket reopened' : 'Message added'));
});

// POST /users/support/:id/rate - customer rates the support service. Allowed
// only after the ticket is resolved/closed. One rating per ticket.
const rateTicket = asyncHandler(async (req, res) => {
    const score = Number(req.body.score);
    const comment = (req.body.comment || '').trim();
    if (!(score >= 1 && score <= 5)) throw new apiError(400, 'Rating must be between 1 and 5');

    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.user._id });
    if (!ticket) throw new apiError(404, 'Ticket not found');
    if (!['resolved', 'closed'].includes(ticket.status)) {
        throw new apiError(400, 'You can rate support once your issue is resolved');
    }

    const tags = Array.isArray(req.body.tags)
        ? [...new Set(req.body.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 8)
        : [];
    ticket.rating = { score, comment, tags, ratedAt: new Date(), agentId: ticket.assignedTo || null };
    await ticket.save();

    return res.status(200).json(new apiResponse(200, ticket, 'Thanks for your feedback'));
});

export { createTicket, getMyTickets, getTicketById, addMessage, getSupportConfig, rateTicket };
