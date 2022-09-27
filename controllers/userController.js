const AppError = require('../utils/appError')
const multer = require('multer');
const sharp = require('sharp');
const User = require("../models/userModel");
const APIFeatures = require("../utils/apiFeatures");
const catchAsync = require("../utils/catchAsync");
const factory = require('./handlerFactory');
const Tour = require('../models/tourModel');


//Lưu vào trong ổ đĩa , thư mục
// const multerStorage = multer.diskStorage({
//   destination : (req,file,callback)=>{
//     callback(null,'public/img/users')
//   },
//   filename : (req,file,callback)=>{
//     const ext = file.mimetype.split('/')[1]
//     callback(null,`user-${req.user.id}-${Date.now()}.${ext}`)
//   }
// })

// Lưu vào trong bộ nhớ
const multerStorage = multer.memoryStorage()
const multerFilter = (req,file,callback)=>{
  if(file.mimetype.startsWith('image')){
    return callback(null,true)
  }else{
    return callback(new AppError('Not an image! Please upload an image',400),false)
  }
}
const upload = multer({
  storage : multerStorage,
  fileFilter : multerFilter
})
const filterObj = (obj,...allowedFields)=>{
  let newObj={}
  Object.keys(obj).forEach(el=>{
    if(allowedFields.includes(el)){
      return newObj[el] = obj[el]
    }
  })
  return newObj
}
exports.uploadUserPhoto = upload.single('photo')
exports.resizeUserPhoto =catchAsync( async (req,res,next)=>{
  if(!req.file) next()
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`
  
 await sharp(req.file.buffer)
  .resize(500,500)
  .toFormat('jpeg')
  .jpeg({quality:90})
  // Lưu vào trong một thư mục 
  .toFile(`public/img/users/${req.file.filename}`)
  
  next()
})
// exports.getAllUsers =catchAsync( async (req, res) => {
//   const users = await User.find()
//   // const features = new APIFeatures(User.find(),req.query).limitFields()
//   // const users = await features.query
  
//   res.status(200).json({
//     status: 'success',
//     // message: 'This route is not yet defined!'
//     results : users.length,
//     data :{
//       users
//     }
//   });
// });
// exports.getUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'This route is not yet defined!'
//   });
// };
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};
exports.updateMe =catchAsync(async (req,res,next)=>{
  //1)Create error if user post password data
 
  if(req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password update',400))
  }
  //2_Fill out fields that are not allowed to updaate
  const filterdBody = filterObj(req.body,'name','email')
  if(req.file) filterdBody.photo = req.file.filename;
  //3)Update user document
 const updatedUser = await User.findByIdAndUpdate(req.user.id,filterdBody,{
  new : true,
  runValidators : true,
  
 })
 res.status(200).json({
  status : 'success',
  data :{
   user: updatedUser
  }
  
 })
})
exports.deleteMe =catchAsync(async(req,res,nex)=>{
  await User.findByIdAndUpdate(req.user.id,{active:false})
  
  res.status(204).json({
    status:'success',
    data : null
  })
})



exports.getUser = factory.getOne(User)
exports.getAllUsers = factory.getAll(User)
exports.createUser = factory.getOne(User)
//Do not update password with this
exports.updateUser = factory.updateOne(User)


exports.deleteUser = factory.deleteOne(User)
