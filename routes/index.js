var db = require('../lib/db')();
var paypal = require('paypal-rest-sdk');
var uuid = require('node-uuid');

// Index page
exports.index = function(req, res) {
	res.locals.session = req.session;
	var error = req.flash('error');
	var message = error.length > 0 ? error[0].message : error;
	res.render('index', {message: message});
};

// Authentication middleware
exports.auth = function(req, res, next) {
	if(req.session.authenticated) {
        next();
    } else {
        res.redirect('signin');
    }
};

exports.signup = function(req, res) {
	res.locals.session = req.session;	
	res.render('sign_up', {});
};

exports.completesignup = function(req, res) {
	res.locals.session = req.session;
	
	var user = req.body.user;
	var userCard = user.credit_card;	
	
	if(user.password != user.password_confirmation) {
		res.render('sign_up', {message: [{desc: "Passwords do not match", type: "error"}]});
	} else {
		//TODO: Add card validation		
		card = {type: userCard.type, number: userCard.number, cvv2: userCard.cvv2, expire_month: userCard.expire_month, expire_year: userCard.expire_year };			
		//TODO: Create user even when card details are not given
		paypal.credit_card.create(card, {}, function(err, card) {
			cardId = (err) ? "" : card.id; 
			db.createUser(user.email, user.password, cardId, function(dbErr, response) {
				if(dbErr) {
					res.render('sign_up', {message: [{desc: err, type: "error"}]});
				} else {
					req.session.authenticated = true;
					req.session.email = user.email;
					if(err) {						
						console.log(err);					
						req.flash('error', {message: [{desc: "You have been signed up but we had trouble saving your card information.", type: "error"}]});
					} else {						
						req.flash('error', {message: [{desc: "You have been signed up successfully", type: "info"}]});
					}
					res.redirect('');
				}
			});			
		});
	}	
};


exports.signin = function(req, res) {
	res.locals.session = req.session;
	var error = req.flash('error');
	var message = error.length > 0 ? error[0].message : error;	
	res.render('sign_in', {message: message});
};


exports.dologin = function(req, res) {
	res.locals.session = req.session;
	
	var user = req.body.user;
	db.authenticateUser(user.email, user.password, function(err, response) {		
		if(err) {		
			req.flash('error', { message : [{desc: err.message, type: "error"}]})
 			res.redirect('signin');
		} else {
			req.session.authenticated = true;
			req.session.email = user.email;			
			res.render('index', {});
		}
	});	
};

exports.signout = function(req, res) {
	res.locals.session = req.session;
	req.session.authenticated = false;
	req.session.email = '';
	res.redirect('/');
};


exports.profile = function(req, res) {
	res.locals.session = req.session;
	db.getUser(req.session.email, function(err, user) {
		if(err || !user) {			
			console.log(err);
			//TODO: Display error message to user
			res.render('profile', { message: [{desc: "Could not retrieve profile information", type: "error"}]});
		} else {		
			paypal.credit_card.get(user.card, {}, function(err, card) {
				if(err) {						
					res.render('profile', {user: user, message: [{desc: "Could not retrieve card information", type: "error"}]});
				} else {
					console.log("No err");
					res.render('profile', {user: user, card: card});						
				}
			});	
		}
	});	
};

exports.updateprofile = function(req, res){
	res.locals.session = req.session;
	var userData = req.body.user;
	var cardData = userData.credit_card;
	
	db.authenticateUser(req.session.email, userData.current_password, function(authErr, authRes) {
		if(authErr) {
			res.render('profile', {user: savedUser, message: [ { desc: "Your current password is incorrect", type: "error"}]});
		} else {
			db.getUser(req.session.email, function(err, savedUser) {
				if(err) {
					res.render('profile', {message: [{ desc: "Could not retrieve user record", type: "error"}]});
				} else if(userData.password != '' && userData.password != userData.password_confirmation) {
					res.render('profile', {user: savedUser, message: [{ desc: "Your passwords do not match", type: "error"}]});
				} else {
					cardId = savedUser.card;
					// Update credit card info
					if(cardData.type !== "" && cardData.number !== "") {
						card = {type: cardData.type, number: cardData.number, cvv2: cardData.cvv2, expire_month: cardData.expire_month, expire_year: cardData.expire_year };		
						paypal.credit_card.create(card, {}, function(err, card) {
							if(err) {
								res.render('profile', {user: savedUser, message: [{ desc: "Error updating profile: " + err, type: "error"}]});
							} else {
								// Update database
								db.updateUser(userData.email, userData.password, card.id, function(err, user) {
									if(err) {
										res.render('profile', {user: savedUser, card: card, message: [{ desc: "Error updating profile: " + err, type: "error"}]});
									} else {
										res.render('profile', {user: user,  card: card, message: [{ desc: "Your profile has been updated", type: "info"}]});
									}
								});						
							}
						});
					} else if (savedUser.card) {
						console.log("retrieving saved card " + savedUser.card);
						paypal.credit_card.get(savedUser.card, {}, function(err, card) {
							// Display profile page even if we cannot display card info
							if(err) {
								card = {};
							}
							db.updateUser(userData.email, userData.password, savedUser.card, function(err, user) {
								if(err) {
									res.render('profile', {user: savedUser, card: card, message: [{ desc: "Error updating profile: " + err, type: "error"}]});
								} else {
									res.render('profile', {user: user,  card: card, message: [{ desc: "Your profile has been updated", type: "info"}]});
								}
							});						
						});
					}			
				}
			});
		}	
	});	
	
};

exports.orderconfirm = function(req, res) {
    res.locals.session = req.session;
    var amount = req.query["orderAmount"],
        desc   = req.query["orderDescription"];
        req.session.amount = amount;
        req.session.desc = desc;
    if(req.session.authenticated) {
        res.render('order_confirm', {'amount' : amount, 'desc' : desc, 'credit_card' : 'true'});
    } else {
        res.redirect('signin');
    }  
	
};

exports.orders = function(req, res) {
}

exports.order = function(req, res) {

	res.locals.session = req.session;
    var order_id = uuid.v4();
    
    if(req.query['order_payment_method'] === 'credit_card')
    {
        var savedCard = {
	        "intent": "sale",
	        "payer": {
	            "payment_method": "credit_card",
	            "funding_instruments": [{
	                "credit_card_token": {}
	            }]
	        },
	        "transactions": [{
	            "amount": {
	                "currency": "USD"
	            },
	            "description": "This is the payment description."
	        }]
	    }
    
		db.getUser(req.session.email, function(err, user) {
			if(err || !user) {			
				console.log(err);
				res.render('order_detail', { message: [{desc: "Could not retrieve user information", type: "error"}]});
			} else {
				savedCard.payer.funding_instruments[0].credit_card_token.credit_card_id = user.card;	
				savedCard.transactions[0].amount.total = req.query['order_amount'];
				savedCard.transactions[0].description = req.session.desc;
				paypal.payment.create(savedCard, {}, function(err, resp) {
					if (err) {
						//TODO: Redirect
                        console.log(err);
						throw err;
					} 
					if (resp) {					    
					    db.insertOrder(order_id, req.session.email, resp.id, resp.state, req.session.amount, req.session.desc, resp.create_time, function(err, order) {
							if(err || !order) {			
								console.log(err);
								res.render('order_detail', { message: [{desc: "Could not save order details", type: "error"}]});
							} else {
								db.getOrders(req.session.email, function(err, orderList) {
									console.log(orderList);
									res.render('order_detail', {
										 title: 'Recent Order Details', 'ordrs' : orderList, message: [{desc: "Order placed successfully.", type: "info"}]
									});	
								});		
							}
		    			});           
					}
	        	});    
			}
  		});   	
	} else if(req.query['order_payment_method'] === 'paypal') {
		var paypalPayment = {
	        "intent": "sale",
	        "payer": {
	            "payment_method": "paypal"
	        },
	        "redirect_urls": {},
	        "transactions": [{
		        "amount": {
			        "currency": "USD"
		        }
	        }]
	    };
    
	    paypalPayment.transactions[0].amount.total = req.query['order_amount'];
	    paypalPayment.redirect_urls.return_url = "http://localhost:3000/orderExecute?order_id=" + order_id;
	    paypalPayment.redirect_urls.cancel_url = "http://localhost:3000/?status=cancel&order_id" + order_id;
	    paypalPayment.transactions[0].description = req.session.desc;
	    paypal.payment.create(paypalPayment, {}, function(err, resp) {
		    if (err) {
		    	console.log(err);
		        throw err;
		    }

			if(resp) {				
				db.insertOrder(order_id, req.session.email, resp.id, resp.state, req.session.amount, req.session.desc, '2012', function(err, order) {
					if(err || !order) {			
						console.log(err);
						res.render('order_detail', { message: [{desc: "Could not save order details", type: "error"}]});
					} else {
						var link = resp.links;				
						for (var i = 0; i < link.length; i++) {
							if(link[i].rel === 'approval_url') {
								res.redirect(link[i].href);
							}			
						}						
					}
				});
			}
		});    
	}
};

exports.orderExecute = function(req, res) {
    res.locals.session = req.session;
    db.getOrder(req.query.order_id, function(err, order) {
        var payer = { payer_id : req.query.PayerID };
        paypal.payment.execute(order.payment_id, payer, {}, function(err, resp) {
            if (err) {
            	//TODO: error handling - redirect
                console.log(err);
            } 
            if (resp) {                
                db.updateOrder(req.query.order_id, resp.state, resp.create_time, function(err, updated) {
                    if(err) {			
	                    console.log(err);
	                    res.render('order_detail', { message: [{desc: "Could not update order information", type: "error"}]});
                    } else {	
                        console.log(updated);
                        db.getOrders(req.session.email, function(err, orderList) {
                            res.render('order_detail', {
                            	title: 'Recent Order Details', 'ordrs' : orderList, message: [{desc: "Order placed successfully.", type: "info"}]
                            });	
                        });
                    }
                });
            }
        });
    });  
 }; 
 
exports.orderList = function(req, res) {
    res.locals.session = req.session;	
	db.getOrders(req.session.email, function(err, orderList) {
		if(err){
			console.log(err);
			res.render('order_detail', { message: [{desc: "Could not retrieve order details", type: "error"}]});
		} else {
			res.render('order_detail', {
				title: 'Recent Order Details', 'ordrs' : orderList
			});	
		}
	});      
};

exports.init = function(config) {
	paypal.configure(config.api);
	db.configure(config.mongo);
}