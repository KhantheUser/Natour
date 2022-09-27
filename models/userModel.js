const mongoose = require('mongoose');
const validator = require('validator');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { nextTick } = require('process');
const userSchema = new mongoose.Schema({
    name :{
        type: String,
        required: [true, 'A user must have a name'],
        
    },
    email : {
        type:String,
        required : [true, 'A user must have an email address'],
        unique : true,
        lowercase : true,
        validate : [validator.isEmail,'Provide a valid email address']
    },
    photo:{
        type : String,
        default :'default.jpg'
    },
    role: {
        type: String,
        enum :{
            
            values :['user','guide','lead-guide','admin'],
        },
        default :'user'
      },
    password :{
        type : String,
        required : [true, 'A user must have a password'],
        minlength : 8,
        select : false
    },
    passwordConfirm : {
        type : String,
        required : [true, 'A user must have a password confirmation'],
        //This only works for save and create 
        validate : {
            validator : function (value){
                return this.password === value
            },
            message : 'Passwords are not the same'
        }
    },
    passwordChangedAt :Date,
    passwordResetToken : String,
    passwordResetExprires : Date,
    active :{
        type:Boolean,
        default : true,
        select : true
    }
    
})
userSchema.pre('save',async function(next){
    //only run this function if the password actually modified
    if(!this.isModified('password')) return next()
    //Hash the password with code 12 and delete the password confirmation field
    this.password = await bcrypt.hash(this.password,12)
    this.passwordConfirm = undefined
 
    next()
})
userSchema.pre('save',function(next){
    if(!this.isModified('password')||this.isNew) return next()
    this.passwordChangedAt =    Date.now()-1000;
    next()
    
})
userSchema.pre(/^find/,function(next){
    this.find({active:{$ne:false}})
    next()
})
//candicatePassword : password in the req.body comes from the user 
//userPassword : password in database and hashed
userSchema.methods.comparePassword =async function(candicatePassword,userPassword){
    return await bcrypt.compare(candicatePassword,userPassword)
}
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
  
      return JWTTimestamp < changedTimestamp;
    }
  
    // False means NOT changed
    return false;
  };
  userSchema.methods.createPasswordResetToken = function(){
    const resetToken = crypto.randomBytes(32).toString('hex');
   this.passwordResetToken=crypto.createHash('sha256').update(resetToken).digest('hex');
   this.passwordResetExprires = Date.now() + 10 * 60 *1000
   
   return resetToken;
  }
const User = mongoose.model('User', userSchema);

module.exports = User;