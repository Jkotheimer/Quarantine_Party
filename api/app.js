#!/usr/bin/node

/**
 * IMPORTS
 * ____________________________________________________________________________
 */
const express = require('express');
const app = express();
const request = require('request');
const querystring = require('querystring');
const crypto = require('./auth.js');

// Generic app variables to access from external modules
app.locals.title = 'Spotiparty';
app.locals.email = 'jkotheimer9@gmail.com';
app.locals.token_exp = 604800000;
app.locals.port = 8081;
app.locals.host = 'http://localhost';
app.locals.domain = 'localhost';
app.locals.root = require('path').dirname(require.main.filename);
app.locals.state_name = 'spotify_auth_state';
app.locals.token_name = 'sp_token';
app.locals.refresh_name = 'sp_refresh';
app.locals.sp_config = require('./sp_config.jsecret');

app.use(express.json()).use(require('cookie-parser')());

/**
 * ROUTES
 * ____________________________________________________________________________
 */
app.get('/login', function(req, res) {
	const local = req.app.locals;

	var state = crypto.gen_token();
	res.cookie(local.state_name, state);

	// request authorization from Spotify
	var scope = 'user-read-private user-read-email user-read-currently-playing ' +
		'user-read-playback-state user-read-recently-played ';
	res.redirect('https://accounts.spotify.com/authorize/?' +
		querystring.stringify({
			response_type: 'code',
			client_id: local.sp_config.client_id,
			scope: scope,
			redirect_uri: `${local.host}/api/callback`,
			state: state
		})
	);
});

app.get('/callback', function(req, res) {
	local = req.app.locals;

	// your application requests refresh and access tokens
	// after checking the state parameter

	var code = req.query.code || null;
	var state = req.query.state || null;
	var storedState = req.cookies ? req.cookies[local.state_name] : null;

	if (state === null || state !== storedState) {
		// There is a discrepency between the state tokens, return an error
		res.redirect('/?' +
			querystring.stringify({ message: 'state_mismatch' })
		);
	} else {
		// Else, send a reqest to spotify asking for a token
		res.clearCookie(local.state_name);
		var auth_header = Buffer.from(local.sp_config.client_id + ':' + local.sp_config.client_secret).toString('base64');
		var authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				code: code,
				redirect_uri: `${local.host}/api/callback`,
				grant_type: 'authorization_code'
			},
			headers: {
				'Authorization': `Basic ${auth_header}`
			},
			json: true
		};

		request.post(authOptions, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				// Spofify sent us a token - use it to access the API

				var access_token = body.access_token,
					refresh_token = body.refresh_token;

				var options = {
					url: 'https://api.spotify.com/v1/me',
					headers: { 'Authorization': 'Bearer ' + access_token },
					json: true
				};

				// use the access token to access the Spotify Web API
				request.get(options, function(error, response, body) {
					console.log("/v1/me get request");
					console.log(body);
				});

				// Pass the token to the browser to make requests from there
				res.cookie(local.token_name, access_token);
				res.cookie(local.refresh_name, refresh_token);
				res.redirect('/');
			} else {
				// The token did not work
				res.redirect('/?' +
					querystring.stringify({
						error: 'invalid_token'
					})
				);
			}
		});
	}
});
// END GET /callback 

app.get('/refresh_token', function(req, res) {
	const local = req.app.locals;

	// requesting access token from refresh token
	var refresh_token = req.cookies[local.refresh_name];
	var auth_header = Buffer.from(local.sp_config.client_id + ':' + local.sp_config.client_secret).toString('base64');
	var authOptions = {
		url: 'https://accounts.spotify.com/api/token',
		headers: { 'Authorization': `Basic ${auth_header}` },
		form: {
			grant_type: 'refresh_token',
			refresh_token: refresh_token
		},
		json: true
	};

	request.post(authOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			res.cookie(local.token_name, body.access_token)
			if(req.query.next != undefined) {
				res.redirect(req.query.next);;
			} else {
				res.send();
			}
		} else if(req.query.next != undefined) {
			res.redirect(req.query.next + '?' + 
				querystring.stringify({error: 'Could not refresh token'})
			)
		} else {
			res.send();
		}
	});
});
// END GET /refresh_token

app.listen(app.locals.port, () => console.log(`Listening on ${app.locals.port}`));
