//jshint esversion:6
require ('dotenv').config();  // npmjs.com/package/dotenv
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require ("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const findOrCreate = require ('mongoose-findorcreate');

// var fs = require("fs");
// var text = fs.readFileSync("./index.txt", "utf-8");
// var commonPassword = text.split("\n");

const app = express();

//console.log(md5("123456"));

app.use (express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

// set up session
app.use(session({
    secret: "Our little secret ",
    resave: false,
    saveUninitialized: false,

  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // connect to the database

mongoose.connect("mongodb+srv://admin-mehmet:Test123@cluster0-zyd32.mongodb.net/nodeuserDB2", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});
mongoose.set("useCreateIndex", true); //#6890 DEprecationWarning hatasina karşı

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String, // bunu eklemeden önce logout yapsakta DB de cookies olarak kayıtlı olduğu için logout olmuyordu
    facebookId: String,
    twitterId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

//create the collection in DB
const User = new mongoose.model ("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Google login Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo",
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
    });
  }
));

// Facebook login Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.APP_ID,
  clientSecret: process.env.APP_SECRET,
  callbackURL: "http://localhost:3000/auth/facebook/secrets"
},
  function (accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

//login with Google

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })); // bu satir bizim google la pop up (bağlanmak) yapmamiz için yeter

  app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });

  // login with Facebook
  app.get("/auth/facebook", passport.authenticate("facebook"));

  app.get(
    "/auth/facebook/secrets",
    passport.authenticate("facebook", { failureRedirect: "/login" }),
    function (req, res) {
      res.redirect("/secrets");
    }
  );

   // login with Twitter
   app.get("/auth/facebook", passport.authenticate("twitter"));

   app.get(
     "/auth/twitter/secrets",
     passport.authenticate("twitter", { failureRedirect: "/login" }),
     function (req, res) {
       res.redirect("/secrets");
     }
   );




  app.get("/", function(req, res){
    res.render("home");
});

  app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register", function(req, res){
    res.render("register");
});

// for save the secrets in secret page
app.get("/secrets", function(req, res){
User.find({"secret": {$ne: null}}, function(err, foundUsers){
  if (err){
    console.log(err);
  } else{
    if(foundUsers) {
     res.render("secrets", {usersWithSecrets: foundUsers});
    }
  }
});
});

//for to submit the page
app.get("/submit", function(req, res){
  if (req.isAuthenticated()){
    res.render("submit");
} else {
    res.redirect("/login");
}
});

//save users secret in DB
app.post("/submit", function(req, res){
  const submittedSecret = req.body.secret;
  console.log(req.user.id);

  User.findById(req.user.id, function(err, foundUser){
    if (err){
      console.log(err);
    } else {
       if(foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  });

});

// logout
app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
}); //Update yapinca cooki ler siliniyor ve logine dönüyor home a değil.


//register
app.post("/register", function(req, res){

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if(err) {
        console.log(err);
        res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
      res.redirect("/secrets");
        });
    }
  });

});

//login
app.post("/login", function(req, res){

    const user = new User({
    username: req.body.username,
    password: req.body.password
    });

    req.login(user, function(err){
      if(err){
        console.log(err);
      }else{
        passport.authenticate("local")(req, res, function(){
            res.redirect("/secrets");
        });
      }
    });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}


app.listen(port, ()=> {
    console.log("Server has started succesfully.")
});
