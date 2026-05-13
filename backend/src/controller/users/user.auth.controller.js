import { Admin } from '../../models/admin.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';


// helper 



// user login handeling 


 const userRegistration = asyncHandler(async()=>{

    const {name,phone, email, password, confirmPassword, avatarUrl, dateOfBirth, gender} = req.body ;

    if (! name || ! phone || ! email || !password || !gender
     ){
        throw new apiError( 400, " all field are required ")
     }

     


 })