/* BEGIN RESOURCES */
const local = {
	title: 'Spotiparty',
	email: 'jkotheimer9@gmail.com',
	token_exp: 604800000,
	host: 'http://localhost',
	domain: 'localhost',
	token_name: 'sp_token',
	refresh_name: 'sp_refresh',
	client_id: '6ea2f255a81f43c581cba104da40c92b'
}

function gen_token() {
   var result		   = '';
   var characters	   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < 64; i++ ) {
	  result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

function get_cookie(cname) {

  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  
  for(var i = 0; i <ca.length; i++) {
	var c = ca[i];
	
	while (c.charAt(0) == ' ') c = c.substring(1);
	if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
  }
  return "";
}
/* END RESOURCES */

/* BEGIN APPLICATION FLOW FUNCTIONS */
// Ensure the user is logged in - check for a token in the cookies
async function login() {
	const token = get_cookie(local.token_name),
		refresh = get_cookie(local.refresh_name);
	if(token && refresh) {
		// The user is logged in to spotify - begin flow
		await _request('GET', '/me', token, display_spotify_info);
		await _request('GET', '/me/player/currently-playing', 
			token, display_player, () => {
				_request('GET', '/me/player/recently-played?limit=1', token, display_player);
			});
	}
	else {
		// The user is not logged in and must be sent to the login route
		window.location = `${local.host}/api/login`;
	}
}

function display_player(player) {
	player = JSON.parse(player);
	console.log(player);
	document.getElementById('status').innerHTML += 
		`<iframe src="https://open.spotify.com/embed/track/${player.items[0].track.id}" 
			width="300" height="80" frameborder="0" allowtransparency="true"></iframe>`;
}

function display_spotify_info(info) {
	info = JSON.parse(info);
	console.log(info);
	document.getElementById('welcome')
		.innerHTML = `Welcome to Quarantine Party, ${info.display_name}!`;
	document.getElementById('logo').parentNode
		.href = info.external_urls.spotify;
}

// A nice simple xhr request wrapper for the spotify api
function _request(method, uri, token, callback, backup) {
	let xhr = new XMLHttpRequest();
	xhr.open(method, `https://api.spotify.com/v1${uri}`, true);
	xhr.setRequestHeader('Authorization', `Bearer ${token}`);
	xhr.onload = function() {
		if(xhr.status == 200) {
			// Success - fill in user info
			callback(xhr.response);
		}
		else if(xhr.status == 401) {
			// Token is expired - refresh
			refresh_token(window.location.pathname);
		} else if(xhr.status == 204) {
			backup();
		} else {
			// Something else went wrong
			console.log(xhr.response);
		}
	}
	xhr.send();
}

// Redirect to the refresh token page and tell it to redirect to $next after refreshing
// We don't need to pass the refresh token with this because it is already a cookie
function refresh_token(next) {
	window.location = `${local.host}/api/refresh_token?next=${next}`;
}

document.onload = login();
