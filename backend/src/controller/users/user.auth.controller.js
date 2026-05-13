import { User } from '../../models/user.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { verifyEmailTemplate } from '../../utils/verifyEmailTemplate.js';
import { sendEmail } from '../../config/sendEmail.js';
import {
    generateAccessToken,
    generateRefreshToken,
} from '../../utils/generateaccesstokenandrefreshtoke.js';
import { uploadOnCloudinary } from '../../utils/cloudinary.js';
import { generateOtp, otpExpireTime } from '../../utils/generateOtp.js';
import { forgetPasswordTemplate } from '../../utils/forgetPasswordTemplete.js';

import jwt from 'jsonwebtoken';

// userRegister handeling

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

    const existingUser = await User.findOne({ phone: phone.trim() });
    if (existingUser) {
        throw new apiError(400, ' user already exits with this phoneNumber');
    }

    const otpCode = generateOtp();
    const otpExpiry = otpExpireTime();

    //now create into db

    const user = await User.create({
        name: name.trim(),
        password,
        phone: phone.trim(),
        email: email?.trim(),
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
    }

    if (email) {
        // const verifyEmailUrl = `${process.env.FRONTEND_URL}/verify-email?code=${user._id}`;

        await sendEmail({
            sendTo: email,
            subject: 'Verify your email',
            html: verifyEmailTemplate({
                name: name,
                otp: otpCode,
            }),
        });
    }
    const tempToken = jwt.sign({ _id: user._id }, process.env.TEMP_TOKEN_SECRET, {
        expiresIn: '10m',
    });
    const userResponse = await User.findById(user._id).select('-password -refreshToken -otp');

    return res
        .status(201)
        .json(new apiResponse(201, userResponse, tempToken, 'Registered successfully'));
});




const verifyOtp = asyncHandler(async (req, res) => {
    {
        /*

        get the otp form the body 
        get temp from header 
        validate it 
        decode tempToken  with jwt.verify ()
        find user in db 
        check otp exits or Notification
        check if exired also or not 
        check matches ?
        then update cser isphoneverifed ues 
        clear otp from db 
        generate access token and refresh after that and send it into respone, 
    */
    }

    const { otp } = req.body;
    const tempToken = req.headers.authorization?.replace('Bearer ', '');

    if (!otp) {
        throw new apiError(400, 'OTP is Required ');
    }
    if (!tempToken) {
        throw new apiError(401, ' unauthorized ');
    }
    // decode token now

    const decodedToken = jwt.verify(tempToken, process.env.TEMP_TOKEN_SECRET);

    // now find the user in db

    const user = await User.findById(decodedToken._id);
    if (!user) {
        throw new apiError(404, ' user not found ');
    }

    // check otp exits or not
    if (!user.otp.code) throw new apiError(400, 'OTP not requested');

    // 7. check otp expired
    if (user.otp.expiresAt < new Date()) throw new apiError(400, 'OTP expired');
    if (user.otp.code !== otp) throw new apiError(400, 'Invalid OTP');

    // 9. update user
    user.isPhoneVerified = true;
    user.otp.code = null;
    user.otp.expiresAt = null;

    // 10. generate tokens


    // 11. clean response
    
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()
    user.refreshToken = refreshToken 
    await user.save()
    const userResponse = await User.findById(user._id).select('-password -refreshToken -otp');


    const option = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    };

    return res.status(200).json(
        new apiResponse(
            200,
            {
                user: userResponse,
                accessToken,
                refreshToken, 
            },
            'OTP verified successfully'
        )
    );
});
