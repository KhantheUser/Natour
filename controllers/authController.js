const User = require('../models/userModel');
const {promisify} = require('util')
const crypto = require('crypto');
const jwt = require('jsonwebtoken')
const catchAsync = require('./../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
 

const signToken = id =>{
    return jwt.sign({
        id : id
       },process.env.JWT_SECRET,{
        expiresIn : process.env.JWT_EXPIRES_IN
       })
}
const createSendToken = (user,statusCode,res)=>{
    const token = signToken(user._id);
    const cookieOptions ={
        expires : new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 *60 *60 * 1000),
        secure : true,
        httpOnly:true
    }
    res.cookie('jwt',token,cookieOptions)
    if(process.env.NODE_ENV ==='production') cookieOptions.secure = true;
    
    // remove the password from the output
    user.password = undefined
    res.status(statusCode).json({
        status : 'success',
        token,
        data : {
            user
        }
    })
}
exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  console.log(url);
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});
exports.login = async(req, res, next)=>{
    const {email,password} = req.body
    if(!email || !password){
      return  next(new AppError('Please provide email and password',400))
    }
    const user =await User.findOne({email:email}).select('+password')
   
    
    //cho await vào ngoặc thế kia vì nếu user không tồn tại thì sẽ không có user.password => lỗi , nhưng nếu không có thì !user nó đã bắt hộ rồi nên sẽ k chạy || !await...
    if(!user || !await user.comparePassword(password,user.password)){
        return next(new AppError('Incorrect email or password',401))
    }
    createSendToken(user,200,res)
    // const token = signToken(user._id)

    // res.status(200).json({
    //     status : 'success',
    //     token
    // })
};
exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });
    res.status(200).json({ status: 'success' });
  };
exports.protect = catchAsync(async(req,res,next)=>{
    //1)Check token and check of it's there
    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1]
    }else if(req.cookies.jwt) {
        token = req.cookies.jwt
    }
    
    if(!token){
        return next(new AppError('You are not logged in ! Please login to access',401))
    }
    //2)Verify token
    // Cách jonas làm để biết jwt.verify thành 1 async function
    // const decoded = await promisify(jwt.verify(token, process.env.JWT_SECRET));

    const decoded = await jwt.verify(token,process.env.JWT_SECRET)
   const freshUser = await User.findById(decoded.id)
//    Check if user is no longer existent after the token is issued
   if(!freshUser){
    return next(new AppError('The user belongs to this token is no longer existent',401))
   }
//    Check if the user changed password after the token is issued
   
   if(freshUser.changedPasswordAfter(decoded.iat)){
    return next( new AppError('User recently changed password ! Please loggin again',401))
   }
//    sau khi qua bước bảo vệ này thì req của các middleware sau sẽ có thuộc tính user
   req.user = freshUser
   res.locals.user = freshUser
    next()
})
//Only for render page , and not for error
exports.isLoggedIn = async (req, res, next) => {
    if (req.cookies.jwt) {
      try {
        // 1) verify token
        const decoded = await promisify(jwt.verify)(
          req.cookies.jwt,
          process.env.JWT_SECRET
        );
  
        // 2) Check if user still exists
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
          return next();
        }
  
        // 3) Check if user changed password after the token was issued
        if (currentUser.changedPasswordAfter(decoded.iat)) {
          return next();
        }
  
        // THERE IS A LOGGED IN USER
        res.locals.user = currentUser;
        return next();
      } catch (err) {
        return next();
      }
    }
    next();
  };
exports.restrictTo = (...role)=>{
    return (req,res,next)=>{
        if(!role.includes(req.user.role)){
            //403 là mã bị cấm
            return next(new AppError('You do not have permission to access',403))
        }
        next()
    }
}
exports.forgotPassword =catchAsync( async (req,res,next)=>{
    //1)Get user based on post email
    const user = await User.findOne({email:req.body.email})
    if(!user){
        return next(new AppError('There is no user with email address',404))
    }
//2)generate random token
    const resetToken =  user.createPasswordResetToken()
    await user.save({validateBeforeSave:false})
    
//3)Send it back to user

  
  try{
    const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;
    // await sendEmail({
    //     email : user.email,
    //     subject : 'Your password reset token (vaild in 10 minutes)',
    //     message
    //   })
    await new Email(user,resetURL).sendPasswordReset()
      res.status(200).json({
        status : 'success',
        message : 'Token sent to email'
      })
  }catch(err){
    user.passwordResetToken = undefined;
    user.passwordResetExprires = undefined
    await user.save({validateBeforeSave:false})
    return next (new AppError('Sending to email has an error. Try again later',500))
  }
})

exports.resetPassword =catchAsync( async(req,res,next)=>{
    //1)Get user base on token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExprires :{$gt : Date.now()}
    })
    //2_If token has not expired , and there is user , set the new password
    if(!user){
        return next(new AppError('Token is invalid or expired',400))
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetExprires = undefined
    user.passwordResetToken = undefined
    await user.save()
    
    //4)loggin user , send JWT
    createSendToken(user,200,res)
    // const token = signToken(user._id)

    // res.status(200).json({
    //     status : 'success',
    //     token
    // })
});
exports.updatePassword = catchAsync( async (req,res,next)=>{
    //1)Get user from collection
    const user = await User.findById(req.user.id).select('+password')
    
   

    
    //2)check if posted current password is correct
    if(!(await user.comparePassword(req.body.passwordCurrent,user.password))){
        return next (new AppError('Current password is wrong',401))
    }
    
    //3)If so update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm
    await user.save()
        //user.findByIdandUpdate will not work as intended
        
        //4)Log user in , send JWT
        createSendToken(user,200,res)
})