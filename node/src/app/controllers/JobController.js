const Job = require('../models/Job');
const User = require('../models/User');
const fetch = require('cross-fetch');
const { mutipleMongooseToObject, mongooseToObject } = require('../../util/mongoose');
const uploadMutipleFiles = require('../../config/firebase/firebase');
const mongoose   = require('mongoose');
mongoose.Promise = Promise;
let db = mongoose.connection;

function check(dataSource, obj, toObj) {
    if(dataSource) {
        obj[toObj] = dataSource[0].firebaseUrl;
        return true;
    }
    return false;
}
class JobController {
    // [GET] job/managers
    showManager(req, res, next) {
        const perPage = 4;
        const page = parseInt(req.query.page) || 1;
        Job.find({userId: req.session.userId , deleted: false})
            .skip((perPage * page) - perPage)
            .limit(perPage)
            .exec((err, jobs) => 
                Job.where({userId: req.session.userId, deleted : false}).countDocuments ((err, count) => {
                if (err) return next(err);
                jobs = mutipleMongooseToObject(jobs);
                jobs.forEach((job) => job.createdAt = job.createdAt.toLocaleString("en-US"));
                res.render('job/manageJob', {
                    jobs: jobs,
                    current: page,
                    pages: Math.ceil(count / perPage),
                });
            }));
    }
    // [GET] job/detail/:id
    showJob(req, res, next) {
        Job.findById(req.params.id)
            .then( job => {
                job = mongooseToObject(Job(job));
                job.createdAt = job.createdAt.toLocaleString("en-US");
                if (job.userId != req.session.userId) {
                    return res.render('notfound');
                }
                res.render('job/detail', {
                    job: job,
                })
            })
            .catch(next);
    }
    // [GET] job/new-job
    newJob(req, res, next) {
        res.render('job/newJob', {
            messageType: req.flash('messageType'),
            message: req.flash('message'),
        });
    }
    // [POST] job/new-job
    create (req, res, next) {
        uploadMutipleFiles(req, res, next)
        .then((a) => {
            const jobApi = {
                service: req.body.service,
                object: req.body.object,
                key: req.body.key,
                request: req.body.request,
            };
            if (!req.files.dataSourceKey) {
                req.flash('messageType', 'danger');
                req.flash('message', "please enter interactions files. Try again.");
                return res.redirect('back');
            }
            else {
                jobApi.dataSourceKey = req.files.dataSourceKey[0].firebaseUrl;
            }
            check(req.files.dataSourceObject, jobApi, 'dataSourceObject');
            check(req.files.dataSourceRequest, jobApi, 'dataSourceRequest');
            try {
                const pyHost = process.env.PYTHON_HOST || '127.0.0.1';
                const pyPort = process.env.PYTHON_PORT || 8000;
                const url = `http://${pyHost}:${pyPort}/api/recommend`;
                console.log(url);
                fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(jobApi),
                    headers: { 'Content-Type': 'application/json' }
                })
                .then( res => res.json())
                .then( json => {
                    if(json.message != 'Done') {
                        req.flash('messageType', 'danger');
                        req.flash('message', json.message + ", Try again.");
                        return res.redirect('back');
                    }
                    const newJob = {
                        userId: req.session.userId,
                        title: req.body.title,
                        description: req.body.description,
                        service: req.body.service,
                        object: req.body.object,
                        key: req.body.key,
                        request: req.body.request,
                        dataSource: { 
                            key: req.files.dataSourceKey[0].originalname,
                        },
                        DSLocation: { 
                            key: req.files.dataSourceKey[0].firebaseUrl,
                        },
                        dataDestination: json.dataDestination,
                        DDLocation: json.DDLocation
                    }
                    if (check(req.files.dataSourceObject, newJob.DSLocation, 'object') == true) {
                        newJob.dataSource.object = req.files.dataSourceObject[0].originalname;
                    }
                    if (check(req.files.dataSourceRequest, newJob.DSLocation, 'request') == true) {
                        newJob.dataSource.request = req.files.dataSourceRequest[0].originalname;
                    }
                    const job = new Job(newJob);
                    job.save()
                    .then( job => {
                        const keys = Object.keys(newJob.dataSource);
                        keys.forEach(key => {
                            if (key == 'key' || key == 'object' || key == 'request') {
                                renameCollection(key, job._id);
                            }       
                        });
                        renameCollection('recommends', job._id);
                        return res.redirect(`/job/detail/${job._id}`);
                    })
                    .catch(error => {
                        console.log(error);
                        req.flash('messageType', 'danger');
                        req.flash('message', "can't save Job. Try again.");
                        return res.redirect('back');
                    })
                })
                .catch( error => {
                    console.log(error);
                    req.flash('messageType', 'danger');
                    req.flash('message', "can't create. Try again.");
                    return res.redirect('back');
                })
            } catch (error) {
                req.flash('messageType', 'danger');
                req.flash('message', "server down. Try again later!");
                return res.redirect('back');
            }
        }).catch(error => {
            req.flash('messageType', 'danger');
            req.flash('message', "can't create(bad request). Try again.");
            return res.redirect('back');
        })
    }
    // [GET] job/trash
    trash(req, res, next) {
        const perPage = 4;
        const page = parseInt(req.query.page) || 1;
        Job.findDeleted({userId: req.session.userId})
            .skip((perPage * page) - perPage)
            .limit(perPage)
            .exec((err, jobs) => 
                Job.countDocumentsDeleted (({userId: req.session.userId}), (err, count) => {
                if (err) return next(err);
                jobs = mutipleMongooseToObject(jobs);
                jobs.forEach((job) => {
                    job.createdAt = job.createdAt.toLocaleString("en-US");
                    job.deletedAt = job.deletedAt.toLocaleString("en-US");
                });
                res.render('job/trash', {
                    jobs: jobs,
                    current: page,
                    pages: Math.ceil(count / perPage),
                });
            }));
    }
    // [DELETE] job/:id
    delete(req, res, next) {
        Job.delete({ _id : req.params.id })
            .then(() => res.redirect('/job/managers'))
            .catch(next);
    }
    // [DELETE] job/:id/destroy
    destroy(req, res, next) {
        Job.deleteOne({ _id : req.params.id })
            .then(() => res.redirect('back'))
            .catch(next);
    }
    // [PATCH] job/:id/restore
    restore(req, res, next) {
        Job.restore({ _id : req.params.id })
            .then(() => res.redirect('back'))
            .catch(next);
    }
    // [POST] job/api/extract
    extract(req, res) {
        if (req.body.object === undefined || req.body.jobId === undefined) {
            res.status(500).json({
                message: "jobId or object is undefined!"
            });
            return;
        }
        Job.findOne({ _id : req.body.jobId})
            .then(job => {
                const ddLocation = job.DDLocation;
                fetch( ddLocation, {
                    method: 'GET',
                })
                .then( res => res.json())
                .then( json => {
                    const key = Object.keys(json[0]);
                    const personId = key[0];
                    function isUser(Id) {
                        return Id[`${personId}`] === req.body.object;
                    }
                    const dt = json.find(isUser);
                    if (dt === undefined) {
                        res.status(400).json({
                            message: "userId does not exist!"
                        });
                        return;
                    }
                    if (req.body.limits === undefined || Number.isInteger(req.body.limits) === false) {
                        res.status(200).json(dt.recommends)
                        return;
                    }
                    res.status(200).json(dt.recommends.slice(0,req.body.limits));
                })
                .catch(err => {
                    res.status(500).json(err);
                    console.log(err);
                    return;
                });
            })
            .catch(err => {
                res.status(400).json({
                    message: "jobId does not exist!"
                });
                return;
            })
    }
    // POST /job/api/update
    updateData(req, res) {
        if (!req.body.jobId) {
            return res.status(401).json({
                message: "add jobId"
            });
        }
        Job.findOne({ _id : req.body.jobId })
            .then(async (job) => {
                const keys = Object.keys(req.body);
                addMany(keys, job._id, req.body)
                .then((message) => {
                    message.message = "Done";
                    if(req.body.newRecommends && req.body.newRecommends === true) {
                        const jobApi = {
                            jobId: job._id,
                            service: job.service,
                            object: job.object,
                            key: job.key,
                            request: job.request,
                        }
                        const pyHost = process.env.PYTHON_HOST || '127.0.0.1';
                        const pyPort = process.env.PYTHON_PORT || 8000;
                        const url = `http://${pyHost}:${pyPort}/api/update-recommend`;
                        try {
                            fetch(url, { 
                                method: 'POST',
                                body: JSON.stringify(jobApi),
                                headers: { 'Content-Type': 'application/json' }
                            })
                            .then( res => res.json())
                            .then( json => {
                                if(json.message != 'Done') {
                                    message[`newRecommends`] = 'update success';
                                } else {
                                    message[`newRecommends`] = 'update failed';
                                }
                            })
                            .catch( error => {
                                message[`newRecommends`] = 'server failed';
                            })
                            .finally(() => {
                                return res.status(200).json(message);
                            })
                        } catch (error) {
                            message[`newRecommends`] = 'server down, Please try later!';
                            res.status(200).json(message);
                            return;
                        }
                    } else {
                        res.status(200).json(message);
                        return;
                    }
                }).catch((err) => {
                    console.log(err);
                    res.status(400).json({
                        message: "bad request"
                    });
                    return;
                })
            }).catch(err => {
                console.log(err)
                res.status(400).json({
                    message: "jobId does not exist!"
                });
                return;
            })
    }
}

async function renameCollection(name, jobId) {
    const listCollections = await db.db.listCollections().toArray();
    listCollections.forEach( collection => {
        if (collection.name == `${name}`) {
            db.collection(name).rename(`${jobId}-${name}`);
            return true;
        }
    });
    return false;
}

function addDataCollection(name, jobId, data) {
    return new Promise(async (resolve, reject) => {
        const listCollections = await db.db.listCollections().toArray();
        listCollections.forEach( collection => {
            if (collection.name == `${jobId}-${name}`) {
                db.db.collection(`${jobId}-${name}`).insertMany(data, function(error, record){
                    if (error) return reject('error');
                    return resolve('done');
                });
            }
        })
        db.db.createCollection(`${jobId}-${name}`)
        .then(collection => {
            db.db.collection(`${jobId}-${name}`).insertMany(data, function(error, record){
                if (error) return reject('error');
                return resolve('done');
            });
        }). catch(err => {
            return reject('error');
        });
    });
}

function addMany(keys, jobId, data) {
    return new Promise((resolve) => {
        const message = {}
        let requests = keys.map((key) => {
            return new Promise((resolve) => {
                if (key == 'key' || key == 'request' || key == 'object') {
                    addDataCollection(key, jobId, data[key])
                    .then(() => {
                        message[`data-${key}`] = "update success";
                        resolve();
                    }).catch((err) => {
                        message[`data-${key}`] = "update failed";
                        resolve();
                    });
                }
                else{  
                    resolve();
                }
            });
        })
        Promise.all(requests).then(() => resolve(message));
    })
}

module.exports = new JobController();
