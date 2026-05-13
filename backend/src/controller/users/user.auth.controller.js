import { User } from '../../models/user.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { verifyEmailTemplate } from '../../utils/verifyEmailTemplate.js';
import { sendEmail } from '../../config/sendEmail.js';
import { uploadOnCloudinary } from '../../utils/cloudinary.js';

// helper

// user login handeling

const userRegister = asyncHandler(async (req, res) => {
    const { name, phone, email, password, confirmPassword, avatarUrl, dateOfBirth, gender } =
        req.body;

    /* step to register the user :
      1. first get the data from the frontend 
      2. check if the user already exists
      3. check if the user is valid
      4. hash the password
      5. save the user to the database
      6. return the user
      */

    if (!name || !phone || !password || !gender) {
        throw new apiError(400, ' all field are required ');
    }

    // handeling email regx

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new apiError(400, 'email should be in correct format ');
        }
    }
    // password
    if (password.length < 8) {
        throw new apiError(400, 'Password must be at least 8 characters');
    }

    if (password !== confirmPassword) {
        throw new apiError(400, '  confirm password should match password');
    }

    //check if the user already exits

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
        throw new apiError(400, ' user already exits with this phoneNumber');
    }

    // generate otp  for opt generation development

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // making it 5 min

    //now create into db

    const user = await User.create({
        name: name.trim(),
        password,
        phone: phone.trim(),
        email: email?.trim() || null,
        dateOfBirth,
        gender,
        otp: {
            code: otpCode,
            expiresAt: otpExpiry,
        },
    });

    if (process.env.NODE_ENV === 'development') {
        console.log(`OTP for ${phone}: ${otpCode}`); // free for dev
    } else {
        await sendSMS(phone, `Your OTP is ${otpCode}`); // Sparrow SMS
    }

    if (email) {
        const verifyEmailUrl = `${process.env.FRONTEND_URL}/verify-email?code=${user._id}`;

        await sendEmail({
            sendTo: email,
            subject: 'Verify your email',
            html: verifyEmailTemplate({
                name: name,
                url: verifyEmailUrl,
            }),
        });
    }
    const userResponse = await User.findById(user._id).select('-password -refreshToken -otp');

    return res.status(201).json(new apiResponse(201, userResponse, 'Registered successfully'));
});
