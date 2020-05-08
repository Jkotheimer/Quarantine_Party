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

// A local private file exporting client_id and client_secret
const sp_config = require('./sp_config.jsecret');

// Generic app variables to access from external modules
app.locals.title = 'Spotiparty';
app.locals.email = 'jkotheimer9@gmail.com';
app.locals.token_exp = 604800000;
app.locals.port = 8081;
app.locals.host = 'http://localhost';
app.locals.domain = 'localhost';
app.locals.root = require('path').dirname(require.main.filename);
app.locals.cookie_name = 'spotify_auth_state';

app.use(express.json());

/**
 * ROUTES
 * ____________________________________________________________________________
 */
app.get('/', function(req, res) {
	const local = req.app.locals;

	var state = crypto.gen_token();
	res.cookie(req.app.locals.cookie_name, state);

	// request authorization from Spotify
	var scope = 'user-read-private user-read-email';
	res.redirect('https://accounts.spotify.com/authorize/?' +
		querystring.stringify({
			response_type: 'code',
			client_id: sp_config.client_id,
			scope: scope,
			redirect_uri: `${local.host}:${local.port}/callback`,
			state: state
		})
	);
});

app.get('/error', (req, res) => {
	res.send(req.query);
});

app.get('/callback', function(req, res) {
	local = req.app.locals;

	// your application requests refresh and access tokens
	// after checking the state parameter

	var code = req.query.code || null;
	var state = req.query.state || null;
	var storedState = req.cookies ? req.cookies[local.cookie_name] : null;
	console.log(storedState)

	// If there is a discrepency between the state tokens, return an error
	if (state === null || state !== storedState) {
		res.redirect('/error?' +
			querystring.stringify({ message: 'state_mismatch' })
		);
	} else {
		// Else, send a reqest to spotify asking for a token
		res.clearCookie(stateKey);
		var authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				code: code,
				redirect_uri: redirect_uri,
				grant_type: 'authorization_code'
			},
			headers: {
				'Authorization': 'Basic ' + (Buffer.alloc(sp_config.client_id + ':' + sp_config.client_secret).toString('base64'))
			},
			json: true
		};

		request.post(authOptions, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				// Spofify sent us a token - use it to access the API

				var access_token = body.access_token,
					refresh_token = body.refresh_token;
				console.log('access_token:');
				console.log(access_token);
				console.log('refresh_token:');
				console.log(refresh_token);

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

				// we can also pass the token to the browser to make requests from there
				res.redirect('/#' +
					querystring.stringify({
						access_token: access_token,
						refresh_token: refresh_token
					})
				);
			} else {
				// The token did not work
				res.redirect('/#' +
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

	// requesting access token from refresh token
	var refresh_token = req.query.refresh_token;
	var authOptions = {
		url: 'https://accounts.spotify.com/api/token',
		headers: { 'Authorization': 'Basic ' + (Buffer.alloc(client_id + ':' + client_secret).toString('base64')) },
		form: {
			grant_type: 'refresh_token',
			refresh_token: refresh_token
		},
		json: true
	};

	request.post(authOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			var access_token = body.access_token;
			res.send({
				'access_token': access_token
			});
		}
	});
});
// END GET /refresh_token

app.listen(app.locals.port, () => console.log(`Listening on ${app.locals.port}`));
