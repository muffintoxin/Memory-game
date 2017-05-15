var CARDS_NUMBER = 20 ;

Games = new Mongo.Collection("games");

if (Meteor.isClient) {
  
  Meteor.subscribe("games");
  Meteor.subscribe("users");

  Router.configure({
    layoutTemplate: 'ApplicationLayout'
  });

   Router.route('/', function () {
    this.render("navbar", {to:"header"});
    this.render("lobby_page", {to:"main"});  
  });

   Router.route('/game/:_id', function () {
    // the user they want to chat to has id equal to 
    // the id sent in after /chat/... 
    var otherUserId = this.params._id;
    Session.set("otherUserId", otherUserId);
    // find a chat that has two users that match current user id
    // and the requested user id
    var filter = {$or:[
                {user1Id:Meteor.userId(), user2Id:otherUserId}, 
                {user2Id:Meteor.userId(), user1Id:otherUserId}
                ]};
    var game = Games.findOne(filter);
    if (!game){// no chat matching the filter - need to insert a new one
      Meteor.call('newGame', Meteor.userId(), otherUserId, function (err, gameId) {
        Session.set("gameId",gameId);
      });
    }
    else {// there is a chat going already - use that. 
      Session.set("gameId",game._id);
    }

    this.render("navbar", {to:"header"});
    this.render("gamePage", {to:"main"});  
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_AND_EMAIL"
  });

  Template.gamePage.helpers({
      getCards:function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        return game.cards;
      },
      getImageSrc: function(card) {
        if (card.isCovered) {
          return '/pictures/sky.jpg';
        }
        else if (card.isDisabled) {
          return '/pictures/disable.png';
        }
        else {
          return card.img_src;
        }
      },
      getOpponentName: function() {
        var otherUserId = Session.get("otherUserId");
        return Meteor.users.findOne({_id: otherUserId}).username;
      },
      getYourScore: function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        if(Meteor.userId() === game.user1Id) {
          return game.score.user1;
        }
        else {
          return game.score.user2;
        }
      },
      getOpponentScore: function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        if(Meteor.userId() === game.user1Id) {
          return game.score.user2;
        }
        else {
          return game.score.user1;
        }
      },
      getCurrentUser: function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        return Meteor.users.findOne({_id: game.turn}).username;
      },
      currentUserWon: function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        if(Meteor.userId() === game.user1Id) {
          return game.score.user1 > game.score.user2;
        }
        else {
          return game.score.user2 > game.score.user1;
        }
      },
      gameOver: function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        return game.score.user1 + game.score.user2 >= game.cards.length/2;
      },
      drawGame: function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        return game.score.user1 === game.score.user2;
      },
      gameReady: function() {
        return !(Session.get("otherUserId") === null || Meteor.userId() === null);
      },
  });

  Template.ApplicationLayout.helpers({
      getCurrentUser: function() {
        var game = Games.findOne({_id:Session.get("gameId")});
        return Meteor.users.findOne({_id: game.turn}).username;
      }
  });
  Template.navbar.helpers({
      users:function() {
        return Meteor.users.find();
      }
  });

  Template.available_user.helpers({
      getUsername:function(userId){
        user = Meteor.users.findOne({_id:userId});
        return user.username;
      }, 
     isMyUser:function(userId){
      return userId == Meteor.userId();
    }
  });

  Template.gamePage.events({
  'click .js-card-clicked':function(event){

    event.preventDefault();

    var cardId = $(event.currentTarget).context['id'];
    console.log(cardId);

    if (Session.get("gameId")){
      Meteor.call('makeMove', Session.get("gameId"), Meteor.userId(), cardId);
    }
  },
  'click .js-restart':function(event){

    event.preventDefault();

    if (Session.get("gameId")){
      Meteor.call('restart', Session.get("gameId"));
    }
  }
 })

}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    if (!Meteor.users.findOne()){
      for (var i=1;i<9;i++){
        var email = "user"+i+"@test.com";
        var username = "user"+i;
        console.log("creating a user with password 'test123' and username/ email: "+email);
        Meteor.users.insert({
          username: username,
          profile:{},
          emails:[{address:email}],
          services:{
            password:{"bcrypt" : "$2a$10$I3erQ084OiyILTv8ybtQ4ON6wusgPbMZ6.P33zzSDei.BbDL.Q4EO"}
          }
        });
      }
    }
  });

  Meteor.publish("games", function(){
    return Games.find();
  });

  Meteor.publish("users", function(){
    return Meteor.users.find();
  });
}

Meteor.methods({
  newGame: function (userId, otherUserId) {
      var cardsBuffer = [];
      
      for (var i = 1; i <= CARDS_NUMBER/2; i++) {
        cardsBuffer.push({
          id: cardsBuffer.length,
          img_src: "/pictures/pic"+i+".jpg",
          isCovered: true,
          isDisabled: false
        });
        cardsBuffer.push({
          id: cardsBuffer.length,
          img_src: "/pictures/pic"+i+".jpg",
          isCovered: true,
          isDisabled: false
        });
      }
      cardsBuffer = _.shuffle(cardsBuffer);

      var gameId = Games.insert({
        user1Id: userId,
        user2Id: otherUserId,
        cards: cardsBuffer,
        turn: userId, //which user can make the next move
        score: {user1: 0, user2: 0},
        firstClickedCardId: null
      });
      return gameId;
  },
  restart: function (gameId) {
      var game = Games.findOne(gameId);
      
      game.cards.forEach(function(card){
        card.isCovered = true;
        card.isDisabled = false;
      });
      game.cards = _.shuffle(game.cards);

      //choose who will start the new game randomly
      game.turn = (Math.random()*10)%2 ? game.user1Id : game.user2Id;

      game.score.user1 = 0;
      game.score.user2 = 0;
      game.firstClickedCardId = null;

      return Games.update({_id: gameId}, game);
  },
  makeMove: function (gameId, userId, cardId) {

    var game = Games.findOne(gameId);
    var currentCard = lodash.find(game.cards, {id: parseInt(cardId)});

    //only if it is the users turn he can make a move
    if( game.turn === userId &&
        cardId !== game.firstClickedCardId &&
        !currentCard.isDisabled )
    {
      currentCard.isCovered = !currentCard.isCovered;
    }
    else {
      //it is not this users turn, so do nothing!
      return;
    }

    var firstClickedCard = null;

    if (game.firstClickedCardId === null) {
      game.firstClickedCardId = cardId;
    }
    else {
      firstClickedCard = lodash.find(game.cards, {id: parseInt(game.firstClickedCardId)});
      if (firstClickedCard.img_src === currentCard.img_src) {
        firstClickedCard.isDisabled = true;
        currentCard.isDisabled = true;

        if(Meteor.userId() === game.user1Id) {
          game.score.user1 += 1;
        }
        else {
          game.score.user2 += 1;
        }
      } 
      else {
        game.turn = ((Meteor.userId() == game.user1Id) ? game.user2Id : game.user1Id);

        Meteor.setTimeout(function() {
          firstClickedCard.isCovered = true;
          currentCard.isCovered = true;
          Games.update({_id: gameId}, game);
        }, 2000);
      }
      game.firstClickedCardId = null;
    }

    return Games.update({_id: gameId}, game);
  }
});