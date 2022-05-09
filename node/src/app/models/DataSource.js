const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');

const Schema = mongoose.Schema;

const DataSource = new Schema(
    {
        jobId: { 
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
        },
        type: {
            type : Schema.Types.String,
        },
        object: {
            type : Schema.Types.String,
        },
        key : {
            type : Schema.Types.String,
        },
        connection: {
            type: Schema.Types.ObjectId,
            ref: 'Connection'
        },
        request : {
            type : Schema.Types.String,
        },
        queryobject: {
            type: Schema.Types.ObjectId,
            ref: 'Query'
        },
        queryrequest: {
            type: Schema.Types.ObjectId,
            ref: 'Query'
        },
        querykey: {
            type: Schema.Types.ObjectId,
            ref: 'Query'
        },
        fileObject: {
            type: Schema.Types.ObjectId,
            ref: 'File'
        },
        fileRequest: {
            type: Schema.Types.ObjectId,
            ref: 'File'
        },
        fileKey: {
            type: Schema.Types.ObjectId,
            ref: 'File'
        },
    },
    {
        timestamps: true,
    },
)

DataSource.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});

module.exports = mongoose.model('DataSource', DataSource);
