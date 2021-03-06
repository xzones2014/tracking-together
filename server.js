var fs =require('fs')
var port = 4444;
var mongoose = require('mongoose');
var express = require('express');
var app = express();
var session = require('express-session');
expressLayouts = require('express-ejs-layouts');
var bodyParser = require("body-parser");
var http = require('http').Server(app);
var io = require('socket.io').listen(http);
var mysql = require('mysql');
var partial = require('express-partial');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({limit:'10mb'}));
app.use(partial())
app.use(expressLayouts)
app.set('view engine', 'ejs')
app.set('layout', 'layout')


var user={}
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}))

app.get("/home",function(req,res){
	res.render('home', { layout: 'layout',page: req.url })
})

app.get("/map",function(req,res){
	res.render('map', { layout: 'layout',page: req.url })
})

app.get("/", function(req,res){
	res.redirect('/login')
})


app.get("/test", function(req,res){
	res.render('page', {layout: 'layoutnew',page: req.url})
})


io.sockets.on('connection', function (socket) {


	socket.on('log',function(data){
		//console.log(data)
	})
	socket.on('send:location',function(data){
		//console.log(data)
		if (!(data.id in user)) {
			//console.log(data)
			//data.id=socket.handshake.address;
			user[data.id] = data;
		}
		io.emit('load:coords', data);
		socket.emit('connection:list',user);
		console.log(socket.handshake.address)
	})
	socket.on('connection:close', function (data) {
		if(user[data.id]!=undefined)
		{
			var dataR={}
			dataR.id=user[data.id].id
			delete user[data.id];
			io.emit('connection:remove',dataR)	
		}
		else
		{
			for(var i in user)
			{	
				if(user[i].socketid==socket.id)
				{
					var dataR={}
					dataR.id=user[i].id
					delete user[i];
					io.emit('connection:remove',dataR)
					console.log(socket.handshake.address+" disconnect")
				}
			}
		}
		

	});
	socket.on('connection:update', function (data) {
		user[data.id] = data;
		io.emit('connection:updatelocation',data)
		
	});
	socket.on('disconnect', function (data) {
		for(var i in user)
		{	
			if(user[i].socketid==socket.id)
			{
				var dataR={}
				dataR.id=user[i].id
				delete user[i];
				io.emit('connection:remove',dataR)
				console.log(socket.handshake.address+" disconnect")
			}
		}
		
	});

	socket.on('reqHelp',function(data){
		console.log(data)
		io.emit('connection:reqHelp',data)
	})
	socket.on('giveHelp',function(data){
		console.log(data)
		io.emit('connection:giveHelp',data)
	})
	setInterval(function() {
	    clearUser(user,io)
	    for (var i = 0; i < 1; i++) {
	    }
	}, 10000)

});


function clearUser(user,socket)
{
	//socket.emit('connection:clear',user);
	user ={}

}
http.listen(port, function(){
  console.log('listening on *:'+port);
});


/*database connection*/
mongoose.connect('mongodb://localhost/test');
/*collection user shcema*/
var userSchema = mongoose.Schema({
    username: String,
    password: String,
    avatar :String,
    friends: {}
})
/* method add friend*/
userSchema.statics.addFriend=function(id,friendId){
	this.model('User').findOneAndUpdate(
	    {_id: id},
	    {$push: {friends: friendId}},
	    {safe: true, upsert: true},
	    function(err, model) {
	        console.log(err);
	    }
	);
}

/* user model*/
var User = mongoose.model('User', userSchema)

app.get('/register',function(req,res){
	res.render('register', {layout: 'layoutlogin',page: req.url})
})
app.post('/register',function(req,res){
	var username=req.body.username
	var password=req.body.password
	var img =req.body.img
	var imgPath='assets/avatar/'+username+'.jpg';
	var newUser = new User({ username:username,password:password,avatar:imgPath});
	User.find({username:username},'username',function(err,result){
        if (err)
            console.log('error occured in the database');
        if(result.length=== 0){
        	newUser.save(function(err){
				var imageBuffer = decodeBase64Image(img);
				fs.writeFile('public/'+imgPath, imageBuffer.data, function(err) { });
				res.end("registrasi berhasil");
			})
        }
        else {
        	res.end("duplicate entry")
        }
    }).limit(1);
})
app.get('/login',function(req,res){
	if(!req.session.login)res.render('login', {layout: 'layoutlogin',page: req.url})
	else res.redirect('/page');
})
app.post('/login',function(req,res){
	var username=req.body.username
	var password=req.body.password
	User.find({username:username,password:password},'username _id avatar',function(err,result){
        if (err)
            console.log('error occured in the database');
        if(result.length=== 0){
       		var data ={
        		status:"AUTH_FAILED"
        	}
       		res.render('login', {layout: 'layoutlogin',page: req.url,data:data})
        }
        else {

        	var data ={
        		status:"success",
        		userData:result
        	}
        	app.locals.data=data
        	req.session.login=true
        	req.session.data=data
        	res.redirect('/page')
        }
    }).limit(1);
})
app.get('/page',function(req,res){
	if(!req.session.login)res.redirect('/login');
	else res.render('page', {layout: 'layoutnew',page: req.url,data:req.session.data})
})
app.get('/logout',function(req,res){
	req.session.destroy()
	res.redirect('/login');
})
function decodeBase64Image(dataString) {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
    response = {};

  if (matches.length !== 3) {
    return new Error('Invalid input string');
  }

  response.type = matches[1];
  response.data = new Buffer(matches[2], 'base64');

  return response;
}
