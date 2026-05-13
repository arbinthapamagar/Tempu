const generateOtp =()=>{
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp;
}

// otp expire time 10 minutes

const otpExpireTime = () => {
    const otpTime = Date.now() + 10 * 60 * 1000// 10 minutes
    return otpTime;
};


export {generateOtp, otpExpireTime}