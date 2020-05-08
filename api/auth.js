#!/usr/bin/node

const crypto = require('crypto');

/**
 * generates random string of characters i.e salt
 * @function
 * @param {number} length - Length of the random string.
 */
var gen_salt = function(length){
    return crypto.randomBytes(Math.ceil(length/2))
            .toString('hex') /** convert to hexadecimal format */
            .slice(0,length);   /** return required number of characters */
};

/**
 * hash password with sha512.
 * @function
 * @param {string} password - List of required fields.
 * @param {string} salt - Data to be validated.
 * @param {string} pepper - random data stored in a secure location on the server
 */
var gen_hash = function(password, salt, pepper){
    var hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
    hash.update(password + pepper);
    var value = hash.digest('hex');
    return {
        salt:salt,
        hash:value
    };
};

function hash_password(password) {
    const salt = gen_salt(16); /** Gives us salt of length 16 */
	const pepper = require('./pepper.jsecret');
    return gen_hash(password, salt, pepper);
}


function verify_password(password, salt, hash) {
	const pepper = require('./pepper.jsecret');
	const hashed_pass = gen_hash(passowrd, salt, pepper);
	return hashed_pass == hash;
}

function gen_token() {
	return gen_salt(64);
}

module.exports = {
	gen_token: gen_token,
	hash_password: hash_password,
	verify_password: verify_password
}
