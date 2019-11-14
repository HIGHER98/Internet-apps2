"use strict"

const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const http = require('http');
const port = 8080;

// import entire SDK
const AWS = require('aws-sdk');
// import AWS object without services
const AWSglobal = require('aws-sdk/global');
// import individual service
const S3 = require('aws-sdk/clients/s3');

const publicKey = 'AKIATTMXSM2AG7EL7XNW';
const privateKey = '1RbQpVnJPTiwo1TIq0lO8bzJsN8zYJLMBko/hWXR';

AWS.config.update({
	region: "eu-west-1",
	accessKeyId: publicKey,
	secretAccessKey: privateKey
});

//Check to see if the credentials are loaded
AWS.config.getCredentials(function(err) {
  if (err) console.log(err.stack);
  // credentials not loaded
		//throw new Error("Could not resolve AWS credentials.");
  else {
    console.log("Access key:", AWS.config.credentials.accessKeyId);
    console.log("Secret access key:", AWS.config.credentials.secretAccessKey);
		console.log("Region: ", AWS.config.region);
	}
});

var dynamodb = new AWS.DynamoDB();
var ddb = new AWS.DynamoDB.DocumentClient();
var params;

app.get('/', (req, res) => res.sendFile(path.join(__dirname+'/public/pages/index.html')));

app.get('/create/', createTable);
app.get('/update/', updateDatabase);
app.get('/query/:title/:year', fetchMovieData);
app.get('/destroy/', deleteTableHelper);
app.listen(port, () => console.log(`Example app listening on port ${port}!`));

//Creates a dynamo table called Movies and inserts movie data into it
function createTable(req, res){
	params = {
		TableName : "Movies",
		KeySchema: [
			{AttributeName: "year", KeyType: "HASH" },
			{ AttributeName: "title", KeyType: "RANGE" }  //Sort key
		],
		AttributeDefinitions: [
			{AttributeName: "year", AttributeType: "N" },
			{AttributeName: "title", AttributeType: "S" }
		],
		ProvisionedThroughput: {
			ReadCapacityUnits: 10, 
			WriteCapacityUnits: 10
		}
	};
	dynamodb.createTable(params, function(err, data) {
		if (err) {
			console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
			res.json({Message:"Failed to create table."});
		} else {
			console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
			res.json(updateDB());
		}
	});
}

function updateDatabase(req, res){
	let response = updateDB();
	console.log("Response:\t"+response);
	res.json(response);
}

function updateDB(){
	var s3 = new AWS.S3();
	//Get the data from the csu44000 bucket
	var s3params = {
		Bucket: 'csu44000assignment2',
		Key: 'moviedata.json'
	}
	s3.getObject(s3params, function (err, data) {
	if (err) {
		console.log(err, err.stack);
	} else {
		let allMovies = JSON.parse(data.Body.toString());
		console.log(allMovies);
		allMovies.forEach(function (movie) {
			let params = {
				TableName: "Movies",
					Item: {
						"title"				: movie.title,
						"year"				: movie.year,
						"director"		: movie.info.directors,
						"rating"			: movie.info.rating,
						"rank"				: movie.info.rank,
						"release"			: movie.info.release_date,
						"lenght_min"	:	movie.info.running_time_secs/60
					}
				};

				ddb.put(params, function (err, data) {
					if (err) {
						console.error("Unable to add movie", movie.title, ". Error JSON:", JSON.stringify(err, null, 2));
					} else {
						console.log("succeeded in adding movie:", movie.title);
					}
				});
			});
		}
		return {Message:"Successfully created and populated the database"};
	})
}

//Gets the data about movies 
function fetchMovieData(req, res){

	let title = req.params.title;
	let year = parseInt(req.params.year);
	console.log("Title:\t"+title+"\tYear:\t"+year);
	let params = {
		TableName : "Movies",
		KeyConditionExpression: "#year = :year AND begins_with(#title,:title)",
		ExpressionAttributeNames: {
			"#year"  : "year",
			"#title" : "title",
		},
		ExpressionAttributeValues: {
			":year" : year,
			":title": title,
		}
	}
	console.log(params);

	ddb.query(params, function(err, data) {
		if (err) {
			console.log("Error querying database:\t", err);
		} else {
			console.log("Successfully queried the databse:\t", data);
			if(data.count === 0){
				res.json({Message:title+" was not found."});
			} else {
				res.json({Message:data.Items})
			}
		}
	});
}

function deleteTableHelper(req, res){
	let a = deleteTable("Movies");
	console.log("a is " + a);
	if(a!=0){
		res.json({Message:"Failed to delete movies table"});
	} else {
		res.json({Message:"Successfully deleted movies table"});
	}
}

function deleteTable(name){
	console.log("Deleting table:\t"+name);
	let params = {
		TableName:name
	};
	dynamodb.deleteTable(params, function(err, data){
		if (err){
			console.log("An error occurred deleting the table " + name);
			console.log(JSON.stringify(err, null, 2));
			return -1;
		} else {
			console.log("Successfully deleted table");
			return 0;
		}
	})
}
