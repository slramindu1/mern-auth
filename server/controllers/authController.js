import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";

// Register User
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.json({ success: false, message: "Missing Details" });
  }

  try {
    const existingUser = await userModel.findOne({ email }); // ✅ Added await
    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new userModel({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // sending welcome email

    const mailoptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Welcome To Trading Edge",
      text: `Welcome To Trading Edge Website. Your Account has Been Created with email id: ${email}`,
    };

    await transporter.sendMail(mailoptions);

    return res.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Login User
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({
      success: false,
      message: "Email and Password are required",
    });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Invalid Email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid Password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, message: "Login successful" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Logout User
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    return res.json({ success: true, message: "Logged Out Successfully" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// send verification otp to user email
export const sendVerifyOtp = async (req, res)=>{
  try{
    const {userId} = req.body;
    const user = await userModel.findById(userId);

    if(user.isAccountVerified){
      return res.json({success: false , message:"Account Already Verified"});
    }

   const otp = String(Math.floor(1000 + Math.random() *90000));

   user.verifyOTP = otp;
   user.verifyOTPExpireAt = Date.now() + 24 * 60 *60 * 1000

   await user.save();

   const mailoption = {
    from: process.env.SENDER_EMAIL,
    to: user.email,
    subject: "Account Verification OTP",
    text: `Your OTP is ${otp}. Verify Your account using This OTP.`,
   }
   await transporter.sendMail(mailoption);
   res.json({success:true, message:'Verification OTP sent on Email'});

  }catch (error){
    res.json({success:false, message:error.message});
  }
}
// verify email using the  otp 
export const VerifyEmail = async (req, res)=>{
  const {userId ,  otp} = req.body;

  if(!userId || !otp) {
    return res.json({success: false, message:'Missing Details'});
  }
  try{
     const user  = await userModel.findById(userId);

     if(!user){
      return res.json({success:false, message: 'User Not Found'});
     }

     if(user.verifyOTP === '' || user.verifyOTP !== otp){
      return res.json({message:false, message:'Invalid Otp'});
     }
     if(user.verifyOTPExpireAt < Date.now()){
      return res.json({success:false, message: 'OTP Expired'});
     }

     user.isAccountVerified = true;
     user.verifyOTP = ''
     user.verifyOTPExpireAt = 0;

     await user.save();
     return res.json({success: true,  message : 'Email Verfied Sucessfully'})



  }catch (error){
    return res.json({success:false, message: error.message});
  }
}

// check if user is authenticated
export const isAuthenticated = async (req, res)=>{
 try{
 return res.json({success:true});
 }catch(error){
  res.json({success:false, message: error.message});
 }
}


// send password Reset Otp
export const sendResetOtp = async (req, res)=>{
 const {email} = req.body;

 if(!email){
  return res.json({success:false,message: 'Email is Required'})
 }

 try{
    
const user = await userModel.findOne({email});
if(!user){
  return res.json({success:false, message: 'User Not Found'});
}
const otp = String(Math.floor(1000 + Math.random() *90000));

   user.resetOtp = otp;
   user.resetOtpExpiereAt = Date.now() +  15 * 60 * 1000

   await user.save();

   const mailoption = {
    from: process.env.SENDER_EMAIL,
    to: user.email,
    subject: "Password Reset Otp",
    text: `Your OTP for resetting your password is ${otp}. using This OTP to proceed with resetting your password.`,
   };

   await transporter.sendMail(mailoption);

   return res.json({success:true, message:'Otp Sent on Your email'})

 }catch (error){
  return res.json({success:false, message: error.message});
 }
}


// Reset User Password
export const  resetPassword = async (req, res)=>{
 const {email, otp, newPassword} = req.body;

 if (!email || !otp || !newPassword){
  return res.json({success:false, message: 'Emial OTP, and new Password are required'});
 }
 try{
 const user = await userModel.findOne({email});
 if(!user){
  return res.json({success:false, message: 'User Not Found'})
 }
 if(user.resetOtp === "" || user.resetOtp !== otp){
   return res.json({success:false, message:'Invalid OTP'});
 }

 if(user.resetOtpExpiereAt < Date.now()){
  return res.json({success:false, message:'OTP Expired'});
 }

 const hashedPassword = await bcrypt.hash(newPassword, 10);

 user.password = hashedPassword;
 user.resetOtp = '';
 user. resetOtpExpiereAt = 0;

 await user.save();

 return res.json({success:true, message: 'Password has been reset Sucessfully'});

 }catch (error){
  return res.json({success:false, message: error.message});
 }
}