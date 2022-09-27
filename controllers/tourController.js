const AppError = require('../utils/appError');
const Tour = require('./../models/tourModel');
const sharp = require('sharp');

const APIFeatures = require('./../utils/apiFeatures');
const factory = require('./handlerFactory')
const catchAsync = require('./../utils/catchAsync');
const multer = require('multer')


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
 

exports.uploadTourImages = upload.fields([
  {name :'imageCover',maxCount :1},
  {name: 'images',maxCount:3}
])
exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});
exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

// exports.getAllTours =catchAsync( async (req, res,next) => {

    
 

//     // EXECUTE QUERY
//     // const features = new APIFeatures(Tour.find(), req.query)
//     //   .filter()
//     //   .sort()
//     //   .limitFields()
//     //   .paginate();
//     // const tours = await features.query;


//     //1A)Filter
//     // const objectQuery = {...req.query}
//     // const tours = await Tour.find(req.query)

//     //1B)Advancede filter
// //     const queryObj = {...req.query}
// //     const excludedFileds = ['page','sort','limit','fields','skip']
// //     excludedFileds.forEach(el=>delete queryObj[el])
// //     let queryStr = JSON.stringify(queryObj)
// //    queryStr= queryStr.replace(/\b(gte|gt|lte|lt)\b/g,(match)=>{
// //       return `$${match}`
// //     })

// // let query =  Tour.find(JSON.parse(queryStr))


// //1C)SORTING
// // if(req.query.sort){
// //   const sortBy = req.query.sort.split(',').join(' ')

// // //  query.sort(sortBy);
// //   query = query.sort(sortBy);
// // }else{
// //   query = query.sort('-createdAt')
// // }


// //3)LImiting
// // if(req.query.fields){
// //   const fields = req.query.fields.split(',').join(' ')
// //   query = query.select(fields)
// // }else{
// //   query = query.select('-__v')
// // }


// //4 pagination
// // const page= req.query.page * 1 || 1
// // const limit =req.query.limit * 1|| 100
// // const skip = (page - 1) * limit

// // query = query.skip(skip).limit(limit)
// // if(req.query.page){
// //   const numberTours = await Tour.countDocuments()
// //   if(skip >= numberTours) throw new Error('This page is not available')
// // }

// //Excute query
// const features = new APIFeatures(Tour.find(),req.query)
// .filter()
// .sort()
// .limitFields()


// let tours  = await features.query

//     // SEND RESPONSE
    
//     res.status(200).json({
//       status: 'success',
//       results: tours.length,
//       data: {
//         tours
//       }
//     });
//   // } catch (err) {
//   //   res.status(404).json({
//   //     status: 'fail',
//   //     message: err
//   //   });
//   // }
// });




// exports.getTour =catchAsync( async (req, res,next) => {
 
//     const tour = await Tour.findById(req.params.id).populate({
//       path : 'reviews'
//     })
//     // Tour.findOne({ _id: req.params.id })
// if(!tour){
//   return next(new AppError('Tour not found with that ID',404))
// }
//     res.status(200).json({
//       status: 'success',
//       data: {
//         tour
//       }
//     });
  
// });




exports.getTour = factory.getOne(Tour,{path :'reviews'})

exports.getAllTours = factory.getAll(Tour)


exports.createTour = factory.createOne(Tour)

exports.updateTour = factory.updateOne(Tour)

exports.deleteTour = factory.deleteOne(Tour)

exports.getTourStats =catchAsync( async (req, res,next) => {
  // try {
    const stats = await Tour.aggregate([
      {
        $match: { avgRating: { $gte: 4.4 } }
      },
      {
        $group: {
          _id: { $toUpper: '$difficulty' },
          numTours: { $sum: 1 },
          numRatings: { $sum: '$ratingsQuantity' },
          avgRating: { $avg: '$ratingsAverage' },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      },
      
      {
        $sort: { avgPrice: 1 }
      }
      // {
      //   $match: { _id: { $ne: 'EASY' } }
      // }
    ]);

    res.status(200).json({
      status: 'success',
      results : stats.length,
      data: {
        stats
      }
    });
  // } catch (err) {
  //   res.status(404).json({
  //     status: 'fail',
  //     message: err
  //   });
  // }
});

exports.getMonthlyPlan =catchAsync( async (req, res,next) => {
  // try {
    const year = req.params.year * 1; // 2021

    const plan = await Tour.aggregate([
      {
        $unwind: '$startDates'
      },
      {
        $match: {
          startDates: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$startDates' },
          numTourStarts: { $sum: 1 },
          tours: { $push: '$name' }
        }
      },
      {
        $addFields: { month: '$_id' }
      },
      {
        $project: {
          _id: 0
        }
      },
      {
        $sort: { numTourStarts: -1 }
      },
      {
        $limit: 12
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        plan
      }
    });
  // } catch (err) {
  //   res.status(404).json({
  //     status: 'fail',
  //     message: err
  //   });
  // }
});


exports.getToursWithin = catchAsync(async(req,res,next)=>{
  const {distance,latlng,unit} = req.params
  const [lat,lng] = latlng.split(',')
  const radians = unit === 'mi' ? distance / 3963.2 : distance /6378.1
  if(!lat || !lng){
    return next(AppError('Please provide latitutr and longitude in format lat,lng .',400))
  }
  console.log(distance,lat,lng,unit);
  const tour = await Tour.find({startLocation :{$geoWithin :{$centerSphere :[[lng,lat],radians]}}})
  res.status(200).json({
    status : 'success',
    results : tour.length,
    data :{
     data: tour
    }
  })
})
exports.getDistances = catchAsync(async(req,res,next)=>{
  const {latlng,unit} = req.params
  const [lat,lng] = latlng.split(',')
  const multipiler = unit ==='mi'? 0.00062 : 0.001
  if(!lat || !lng){
    return next(AppError('Please provide latitutr and longitude in format lat,lng .',400))
  }

 const distance = await Tour.aggregate([
    {
      $geoNear :{
        near:{
          type : 'Point',
          coordinates : [lng *1,lat *1]
        },
        distanceField : 'distance',
        distanceMultiplier : multipiler
      }
    },
    {
      $project : {
        //  Viết số 1 ở kia biểu thị những thuộc 
        name : 1,
        distance : 1
        
      }
    },
    // {
    //   $match : {
    //     distance : { $lte :300}
    //   }
    // }
  ])
  
  res.status(200).json({
    status : 'success',
    
    data :{
     data: distance
    }
  })
})