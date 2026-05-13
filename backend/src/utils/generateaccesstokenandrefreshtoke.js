import jsonwebtoken from 'jsonwebtoken';
import { apiError } from './apiError.js';
import { User } from '../models/user.model.js';

const generateAccessToken = async (userId) => {
    try {
        const accessToken = jsonwebtoken.sign(
            { id: userId }, 
            process.env.GENERATE_ACCESSTOKEN_KEY, 
            { expiresIn: "1d" }
        );
        return accessToken; 
    } catch (error) {
        throw new apiError(500, "Failed to generate access token");
    }
};

const generateRefreshToken = async (userId) => {
    try {
        const refreshToken = jsonwebtoken.sign(
            { _id: userId }, 
            process.env.GENERATE_REFRESHTOKEN_KEY, 
            { expiresIn: "100d" }
        );
        
        // Update database with refresh token
        await User.updateOne(
            { _id: userId }, 
            { refreshToken: refreshToken }
        );
        
        return refreshToken;
    } catch (error) {
        throw new apiError(500, "Failed to generate refresh token");
    }
};

export { generateAccessToken, generateRefreshToken };