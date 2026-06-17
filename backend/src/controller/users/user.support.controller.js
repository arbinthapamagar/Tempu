import { SupportTicket } from '../../models/supportTicket.model.js';
import { getSupportSettings } from '../../models/supportSettings.model.js';
import { uploadOnCloudinary } from '../../utils/cloudinary.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

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

    const ticket = await SupportTicket.create({
        userId: req.user._id,
        subject,
        category,
        tripId: tripId || null,
        messages: [{ senderId: req.user._id, senderType: 'user', message }],
    });
    return res.status(201).json(new apiResponse(201, ticket, 'Support ticket created'));
});

const getMyTickets = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const tickets = await SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .populate('assignedTo', 'name');
    return res.status(200).json(new apiResponse(200, tickets, 'Tickets fetched'));
});

const getTicketById = asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.user._id })
        .populate('assignedTo', 'name');
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
    if (['resolved', 'closed'].includes(ticket.status)) {
        throw new apiError(400, 'Cannot add message to a resolved/closed ticket');
    }

    const entry = { senderId: req.user._id, senderType: 'user', message };

    if (hasFile) {
        const result = await uploadOnCloudinary(req.file.path);
        if (!result?.secure_url) throw new apiError(500, 'Failed to upload attachment');
        entry.attachmentUrl = result.secure_url;
        entry.attachmentType = (req.file.mimetype || '').startsWith('audio/') ? 'audio' : 'file';
        entry.attachmentName = req.file.originalname || null;
    }

    ticket.messages.push(entry);
    await ticket.save();

    return res.status(200).json(new apiResponse(200, ticket, 'Message added'));
});

export { createTicket, getMyTickets, getTicketById, addMessage, getSupportConfig };
