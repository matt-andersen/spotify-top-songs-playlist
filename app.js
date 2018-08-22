var axios = require("axios");
var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = 'CLIENT ID'; // Your client id
var client_secret = 'CLIENT SECRET'; // Your secret
var redirect_uri = 'REDIRECT URL'; // Your redirect uri

var siteUrl = "http://104.196.252.233/";

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

var playlistId;

app.use(express.static(__dirname + '/html'))
    .use(cors())
    .use(cookieParser());

app.get('/login', function (req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = 'playlist-modify-html user-top-read';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

app.get('/callback', function (req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token

                var options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: {'Authorization': 'Bearer ' + access_token},
                    json: true
                };

                // use the access token to access the Spotify Web API
                request.get(options, function (error, response, body) {
                    createPlaylist(body, access_token);
                    getUserTopSongs(body, access_token);
                    res.redirect('/#' + body.id);
                });

            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
});

console.log('Listening on 8888');
app.listen("80");

function createPlaylist(body, access_token) {
    let jsonData = {
        name: "My Top Songs of All Time",
        public: true,
        description: "This is a playlist of my most played songs of all time. Generated via: " + siteUrl
    };

    axios({
        method: 'post',
        url: `https://api.spotify.com/v1/users/${body.id}/playlists`,
        data: jsonData,
        dataType: 'json',
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json'
        }
    })
        .then(res => {
            playlistId = res.data.id;
        })

        .catch(error => {
            console.log(error.toString())
        });
}

function getUserTopSongs(body, access_token) {
    axios({
        method: 'get',
        url: "https://api.spotify.com/v1/me/top/tracks?time_range=long_term",
        headers: {
            'Authorization': 'Bearer ' + access_token,
        },
    })
        .then(res => {

            let songUris = [];

            for (let i = 0; i < 20; i++) {
                songUris[i] = res.data.items[i].uri;
            }
            addSongToPlaylist(songUris, access_token)
        })

        .catch(error => {
            console.log(error.toString())
        });
}

function addSongToPlaylist(songUris, access_token) {

    songUris = songUris.toString();

    axios({
        method: 'post',
        url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks?position=${0}&uris=${songUris}`,
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json'
        },
    })
        .then(res => {
        })

        .catch(error => {
            console.log(error.toString())
        });
}

