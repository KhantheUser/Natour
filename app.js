const express = require('express');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const AppError = require('./utils/appError')
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const globalErrorHandler = require('./controllers/errorsController')
const app = express();

app.set('view engine', 'pug');
app.set('views',path.join(__dirname, 'view'));
// 1)Global MIDDLEWARES

//Serving static file

// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));
//Set Security HTTP Headers
// app.use(helmet())

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}


const limiter = rateLimit({
  max : 100,
  windowMs:60*60*1000,
  message : 'Too many requests from this IP address,please try again in an hour'
})
// 
app.use('/api',limiter)
//Body parser  , reading data from req.body
app.use(express.json({limit:'10kb'}));
app.use(express.urlencoded({extended:true,limit:'10kb'}));
//Cookie parser
app.use(cookieParser())

//Dọn dẹp dữ liệu độc hại against NoSQL query injection
app.use(mongoSanitize())

//Dọn dẹp dữ liệu độc hại against XSS : tấn công kịch bản
app.use(xss())

//Prevent parameter pollution
app.use(hpp({
  // Cho phép các tham số dưới => không loại bỏ nếu bị lặp lại
  whitelist : ['duration','ratingsAverage',"ratingsQuantity","maxGroupSize","price","difficulty"]
}))




//Test middlewares
app.use((req, res, next) => {
  console.log('Hello from the middleware 👋');
  console.log(req.cookies)
  next();
});


//Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  
  next();
});

// 3) ROUTES

app.use('/',viewRouter)
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews',reviewRouter)
app.use('/api/v1/bookings',bookingRouter)
app.all('*', (req, res, next) => {
  // res.status(404).json({
  //   status :'fail',
  //   message : `Can not find ${req.originalUrl}`
  // })
  
  
  // const err = new Error(`Can not find ${req.originalUrl}`);
  // err.status = 404;
  // err.statusCode = 'fail'
  next(new AppError(`Can not find ${req.originalUrl}`,404))
})
app.use(globalErrorHandler)
module.exports = app;
