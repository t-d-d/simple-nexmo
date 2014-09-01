/**
 * The MIT License (MIT)
 *
 * Copyright © 2013-2014 Calvert Yang
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

(function() {
  var Nexmo = function () {
    /**
     * Module dependencies.
     */
    var http = require('http');
    var https = require('https');
    var querystring = require('querystring');

    /**
     * API version
     *
     * @constant
     */
    var _VERSION = '1.0.6';

    /**
     * API http request header
     *
     * @constant
     */
    var _HEADERS = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'accept': 'application/json'
    };

    /**
     * API base url
     *
     * @constant
     */
    var _BASE_URL = 'rest.nexmo.com';

    /**
     * API endpoint
     *
     * @constant
     */
    var _ENDPOINT = {
      sms: '/sms/json',
      ussd: '/ussd/json',
      tts: '/tts/json',
      accountGetBalance: '/account/get-balance',
      accountPricing: '/account/get-pricing/outbound',
      accountSettings: '/account/settings',
      accountTopUp: '/account/top-up',
      accountNumbers: '/account/numbers',
      numberSearch: '/number/search',
      numberBuy: '/number/buy',
      numberCancel: '/number/cancel',
      numberUpdate: '/number/update',
      searchMessage: '/search/message',
      searchMessages: '/search/messages',
      searchRejections: '/search/rejections'
    };

    /**
     * API error messages
     *
     * @constant
     */
    var _ERROR_MESSAGES = {
      initializeRequired: 'nexmo not initialized, call nexmo.initialize(api_key, api_secret) first before calling any nexmo API',
      keyAndSecretRequired: 'Key and secret cannot be empty',
      invalidTextMessage: 'Invalid text message',
      invalidBody: 'Invalid body value in binary message',
      invalidUdh: 'Invalid udh value in binary message',
      invalidTitle: 'Invalid title in WAP push message',
      invalidUrl: 'Invalid url in WAP push message',
      invalidSender: 'Invalid from address',
      invalidRecipient: 'Invalid to address',
      invalidCountryCode: 'Invalid country code',
      invalidMsisdn: 'Invalid MSISDN passed',
      invalidMessageId: 'Invalid message id(s)',
      tooManyMessageId: 'Too many message id',
      invalidDate: 'Invalid date value',
      invalidNewSecret: 'Invalid new secret',
      invalidCallbackUrl: 'Invalid callback url',
      invalidTransactionId: 'Invalid transaction id'
    };

    /**
     * Settings
     *
     * @private
     */
    var _apiKey = '';
    var _apiSecret = '';
    var _useHttps = true;
    var _debugMode = false;
    var _initialized = false;

    /**
     * Initialize settings, protocol and debug are optional.
     *
     * @param {string} key - Api key
     * @param {string} secret - Api secret
     * @param {string} protocol - Optional, protocol `http` or `https`
     * @param {boolean} debug - Optional, show debug messages
     */
    var initialize = function initialize (key, secret, protocol, debug) {
      if (!key || !secret) {
        throw _ERROR_MESSAGES.keyAndSecretRequired;
      }

      _apiKey = key;
      _apiSecret = secret;
      _useHttps = !(protocol === 'http');
      _debugMode = debug;
      _initialized = true;
    };

    /**
     * Messaging SMS - Send a Plain text message
     *
     * @param {string} sender - Sender address may be alphanumeric
     * @param {string} recipient - Mobile number in international format, and one recipient per request
     * @param {string} message - Body of the text message
     * @param {requestCallback} callback - The callback that handles the response
     */
    var sendTextMessage = function sendTextMessage (sender, recipient, message, callback) {
      if (!message) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidTextMessage));
      } else {
        options = {
          from: sender,
          to: recipient,
          type: 'unicode',
          text: message
        };

        sendMessage(options, _ENDPOINT.sms, callback);
      }
    };

    /**
     * Messaging SMS - Send a Binary data message
     *
     * @param {string} sender - Sender address may be alphanumeric
     * @param {string} recipient - Mobile number in international format, and one recipient per request
     * @param {string} body - Hex encoded binary data
     * @param {string} udh - Hex encoded udh
     * @param {requestCallback} callback - The callback that handles the response
     */
    var sendBinaryMessage = function sendBinaryMessage (sender, recipient, body, udh, callback) {
      var options;
      if (!body) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidBody));
      } else if (!udh) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidUdh));
      } else {
        options = {
          from: sender,
          to: recipient,
          type: 'binary',
          body: body,
          udh: udh
        };
        sendMessage(options, _ENDPOINT.sms, callback);
      }
    };

    /**
     * Messaging SMS - Send a WAP push message
     *
     * @param {string} sender - Sender address may be alphanumeric
     * @param {string} recipient - Mobile number in international format, and one recipient per request
     * @param {string} title - Title of WAP Push
     * @param {string} url - WAP Push URL
     * @param {string} validity - Optional, set how long WAP Push is available in milliseconds
     * @param {requestCallback} callback - The callback that handles the response
     */
    var sendWapPushMessage = function sendWapPushMessage (sender, recipient, title, url, validity, callback) {
      var options;

      if (!title) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidTitle));
      } else if (!url) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidUrl));
      } else {
        if (typeof validity === 'function') {
          callback = validity;
          validity = 172800000;
        }

        options = {
          from: sender,
          to: recipient,
          type: 'wappush',
          title: title,
          url: encodeURIComponent(url),
          validity: validity
        };

        sendMessage(options, _ENDPOINT.sms, callback);
      }
    };

    /**
    * Voice TTS - Send a simple text-to-speech  message
    *
    * @param {string} sender - Sender address may be alphanumeric
    * @param {string} recipient - Mobile number in international format, and one recipient per request
    * @param {string} message - Body of the voice message
    * @param {requestCallback} callback - The callback that handles the response
    */
    var sendTTSMessage = function sendTTSMessage (sender, recipient, message, callback) {
      if (!message) {
          sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidTextMessage));
      } else {
          options = {
              from: sender,
              to: recipient,
              text: message
          };

          sendMessage(options, _ENDPOINT.tts, callback);
      }
    };

    /**
     * Account: Pricing - Retrieve current account balance
     *
     * @param {requestCallback} callback - The callback that handles the response
     */
    var getBalance = function getBalance (callback) {
      sendRequest(_ENDPOINT.accountGetBalance, null, callback);
    };

    /**
     * Account: Pricing - Retrieve our outbound pricing for a given country
     *
     * @param {string} countryCode - A 2 letter country code
     * @param {requestCallback} callback - The callback that handles the response
     */
    var getPricing = function getPricing (countryCode, callback) {
      if (!countryCode || countryCode.length !== 2) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidCountryCode));
      } else {
        var data = {
          country: countryCode
        };

        sendRequest(_ENDPOINT.accountPricing, data, callback);
      }
    };

    /**
     * Account: Settings - Update API secret
     *
     * @param {string} newSecret - New API secret
     * @param {requestCallback} callback - The callback that handles the response
     */
    var updateSecret = function updateSecret (newSecret, callback) {
      if (!newSecret || newSecret.length > 8) {
        sendError(callback, new Error(_ERROR_MESSAGES.invalidNewSecret));
      } else {
        var data = {
          newSecret: encodeURIComponent(newSecret)
        };

        sendRequest(_ENDPOINT.accountSettings, data, 'POST', callback);
      }
    };

    /**
     * Account: Settings - Update inbound call back URL
     *
     * @param {string} newUrl - Inbound call back URL
     * @param {requestCallback} callback - The callback that handles the response
     */
    var updateMoCallBackUrl = function updateMoCallBackUrl (newUrl, callback) {
      if (!newUrl) {
        sendError(callback, new Error(_ERROR_MESSAGES.invalidCallbackUrl));
      } else {
        var data = {
          moCallBackUrl: encodeURIComponent(newUrl)
        };

        sendRequest(_ENDPOINT.accountSettings, data, 'POST', callback);
      }
    };

    /**
     * Account: Settings - Update DLR call back URL
     *
     * @param {string} newUrl - DLR call back URL
     * @param {requestCallback} callback - The callback that handles the response
     */
    var updateDrCallBackUrl = function updateDrCallBackUrl (newUrl, callback) {
      if (!newUrl) {
        sendError(callback, new Error(_ERROR_MESSAGES.invalidCallbackUrl));
      } else {
        var data = {
          drCallBackUrl: encodeURIComponent(newUrl)
        };

        sendRequest(_ENDPOINT.accountSettings, data, 'POST', callback);
      }
    };

    /**
     * Account: Top Up - Top-up your account, only if you have turn-on the 'auto-reload' feature
     *
     * @param {string} transactionId - The transaction id associated with your **first** 'auto reload' top-up
     * @param {requestCallback} callback - The callback that handles the response
     */
    var getTopUp = function getTopUp (transactionId, callback) {
      if (!transactionId) {
        sendError(callback, new Error(_ERROR_MESSAGES.invalidTransactionId));
      } else {
        var data = {
          trx: transactionId
        };

        sendRequest(_ENDPOINT.accountTopUp, data, 'POST', callback);
      }
    };

    /**
     * Account: Numbers - Get all inbound numbers associated with Nexmo account
     *
     * @param {requestCallback} callback - The callback that handles the response
     */
    var getNumbers = function getNumbers (callback) {
      sendRequest(_ENDPOINT.accountNumbers, null, callback);
    };

    /**
     * Number: Search - Get available inbound numbers for a given country
     *
     * @param {string} countryCode - Country code
     * @param {string} pattern - Optional, a matching pattern
     * @param {number} index - Optional, page index (> 0, default 1)
     * @param {number} size - Optional, page size (max 100, default 10)
     * @param {requestCallback} callback - The callback that handles the response
     */
    var searchNumbers = function searchNumbers (countryCode, pattern, index, size, callback) {
      if (!countryCode || countryCode.length !== 2) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidCountryCode));
      } else {
        var data = {
          country: countryCode
        };

        if (typeof pattern === 'function') {
          callback = pattern;
        } else {
          data['pattern'] = pattern;
          if (typeof index === 'function') {
            callback = index;
          } else {
            data['index'] = index;
            if (typeof size === 'function') {
              callback = size;
            } else {
              data['size'] = size;
            }
          }
        }

        sendRequest(_ENDPOINT.numberSearch, data, callback);
      }
    };

    /**
     * Number: Buy - Purchase a given inbound number
     *
     * @param {string} countryCode - Country code
     * @param {string} msisdn - An available inbound number
     * @param {requestCallback} callback - The callback that handles the response
     */
    var buyNumber = function buyNumber (countryCode, msisdn, callback) {
      if (!countryCode || countryCode.length !== 2) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidCountryCode));
      } else if (!msisdn || msisdn.length < 10) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidMsisdn));
      } else {
        var data = {
          country: countryCode,
          msisdn: msisdn
        };

        sendRequest(_ENDPOINT.numberBuy, data, 'POST', callback);
      }
    };

    /**
     * Number: Cancel - Cancel a given inbound number subscription
     *
     * @param {string} countryCode - Country code
     * @param {string} msisdn - One of your inbound numbers
     * @param {requestCallback} callback - The callback that handles the response
     */
    var cancelNumber = function cancelNumber (countryCode, msisdn, callback) {
      if (!countryCode || countryCode.length !== 2) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidCountryCode));
      } else if (!msisdn || msisdn.length < 10) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidMsisdn));
      } else {
        var data = {
          country: countryCode,
          msisdn: msisdn
        };

        sendRequest(_ENDPOINT.numberCancel, data, 'POST', callback);
      }
    };

    /**
     * Number: Update - Update your number callback
     *
     * @param {string} countryCode - Country code
     * @param {string} msisdn - One of your inbound numbers
     * @param {string} newUrl - Optional, number call back URL
     * @param {string} sysType - Optional, the associated system type for SMPP client only
     * @param {requestCallback} callback - The callback that handles the response
     */
    var updateNumberCallback = function updateNumberCallback (countryCode, msisdn, newUrl, sysType, callback) {
      throw 'Not yet implemented!';
    };

    /**
     * Search: Message - Search a previously sent message for a given message id
     *
     * @param {string} messageId - Your message id received at submission time
     * @param {requestCallback} callback - The callback that handles the response
     */
    var searchMessage = function searchMessage (messageId, callback) {
      if (!messageId) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidMessageId));
      } else {
        var data = {
          id: messageId
        };

        sendRequest(_ENDPOINT.searchMessage, data, callback);
      }
    };

    /**
     * Search: Message - Search sent messages by message ids
     *
     * @param {Array} messageIds - A list of message ids, up to 10
     * @param {requestCallback} callback - The callback that handles the response
     */
    var searchMessageByIds = function searchMessageByIds (messageIds, callback) {
      if (!messageIds || messageIds.length === 0) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidMessageId));
      } else {
        if (messageIds.length > 10) {
          sendErrorResponse(callback, new Error(_ERROR_MESSAGES.tooManyMessageId));
        } else {
          var data = { ids: [] };

          for (var idx = 0, len = messageIds.length; idx < len; idx++) {
            data.ids.push(messageIds[idx]);
          }

          sendRequest(_ENDPOINT.searchMessages, data, callback);
        }
      }
    };

    /**
     * Search: Message - Search sent messages by recipient and date
     *
     * @param {string} date - Message date submission YYYY-MM-DD
     * @param {string} to - A recipient number
     * @param {requestCallback} callback - The callback that handles the response
     */
    var searchMessagesByRecipient = function searchMessagesByRecipient (date, to, callback) {
      if (!date) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidDate));
      } else if (!to) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidRecipient));
      } else {
        var data = {
          date: date,
          to: to
        };

        sendRequest(_ENDPOINT.searchMessages, data, callback);
      }
    };

    /**
     * Search: Rejections - Search rejected messages
     *
     * @param {string} date - Message date submission YYYY-MM-DD
     * @param {string} to - Optional, a recipient number
     * @param {requestCallback} callback - The callback that handles the response
     */
    var searchRejections = function searchRejections (date, to, callback) {
      if (!date) {
        sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidDate));
      } else {
        var data = {
          date: date
        };

        if (typeof to === 'function') {
          callback = to;
        } else if (to) {
          data.to = to;
        }

        sendRequest(_ENDPOINT.searchRejections, data, callback);
      }
    };

    /**
    * Check required parameter and send out SMS or TTS message
    *
    * @param {Object} data - Message object
    * @param {requestCallback} callback - The callback that handles the response
    * @private
    */
    var sendMessage = function sendMessage (data, endpoint, callback) {
      if (!data.from) {
          sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidSender));
      } else if (!data.to) {
          sendErrorResponse(callback, new Error(_ERROR_MESSAGES.invalidRecipient));
      } else {
          log('Sending' + endpoint.slice(1,4) + ' message from ' + data.from + ' to ' + data.to + ' with message ' + data.text);

          sendRequest( endpoint, data, 'POST', function(err, apiResponse) {
              if (!err && apiResponse.status && apiResponse['error-text']) {
                  sendErrorResponse(callback, new Error(apiResponse['error-text'], apiResponse));
              }
              else if (!err && apiResponse.status && apiResponse.messages && apiResponse.messages[0].status > 0) {
                  sendErrorResponse(callback, new Error(apiResponse.messages[0]['error-text'], apiResponse));
              } else {
                  if (callback) {
                      callback(err, apiResponse);
                  }
              }
          });
      }
    };

    /**
     * Send HTTP/HTTPS request to nexmo
     *
     * @param {string} endpoint - API endpoint
     * @param {string} data - Stringify data
     * @param {string} method - HTTP method
     * @param {requestCallback} callback - The callback that handles the response
     * @private
     */
    var sendRequest = function sendRequest (endpoint, data, method, callback) {
      if (!_initialized) {
        throw _ERROR_MESSAGES.initializeRequired;
      }

      var credentials = {
        api_key: _apiKey,
        api_secret: _apiSecret
      };

      var dataString = querystring.stringify(credentials);

      if (data) {
        dataString += '&' + querystring.stringify(data);
      }

      if (typeof method === 'function') {
        callback = method;
        method = 'GET';
      }

      // Setting Content-Length header when using POST action
      if (method === 'POST') {
        _HEADERS['Content-Length'] = dataString.length;
      } else {
        endpoint += '?' + dataString;
      }

      var options = {
        host: _BASE_URL,
        port: 443,
        path: endpoint,
        method: method,
        headers: _HEADERS
      };

      var request;
      if (!_useHttps) {
        options.port = 80;
        request = http.request(options);
      } else {
        request = https.request(options);
      }

      log(options);

      if (method === 'POST') {
        request.write(dataString);
      }

      request.end();

      var buffer = '';
      request.on('response', function (response) {
        response.setEncoding('utf8');

        response.on('data', function (chunk) {
          buffer += chunk;
        });

        response.on('end', function () {
          var responseData;

          log('response ended');

          if (callback) {
            var err = null;

            try {
              responseData = JSON.parse(buffer);
            } catch (_error) {
              var parserError = _error;
              log(parserError);
              log('could not convert API response to JSON, above error is ignored and raw API response is returned to client');
              err = parserError;
            }

            callback(err, responseData);
          }
        });

        response.on('close', function (e) {
          log('problem with API request detailed stacktrace below ');
          log(e);
          callback(e);
        });
      });

      request.on('error', function (e) {
        log('problem with API request detailed stacktrace below ');
        log(e);
        callback(e);
      });
    };

    /**
     * Send back or throw out error response
     *
     * @param {requestCallback} callback - The callback that handles the response
     * @param {Object} err - Error object
     * @param {Object} returnData - Response data
     * @private
     */
    var sendErrorResponse = function sendErrorResponse (callback, err, returnData) {
      if (callback) {
        callback(err, returnData);
      } else {
        throw err;
      }
    };

    /**
     * Logging messages
     *
     * @param {Object} - Message object
     * @private
     */
    var log = function log (message) {
      if (message instanceof Error) {
        console.log(message.stack);
      }

      if (_debugMode) {
        if (typeof message === 'object') {
          console.dir(message);
        } else {
          console.log(message);
        }
      }
    };

    return {
      VERSION: _VERSION,
      init: initialize,
      sendTextMessage: sendTextMessage,
      sendBinaryMessage: sendBinaryMessage,
      sendWapPushMessage: sendWapPushMessage,
      sendTTSMessage: sendTTSMessage,
      getBalance: getBalance,
      getPricing: getPricing,
      updateSecret: updateSecret,
      updateMoCallBackUrl: updateMoCallBackUrl,
      updateDrCallBackUrl: updateDrCallBackUrl,
      getTopUp: getTopUp,
      getNumbers: getNumbers,
      searchNumbers: searchNumbers,
      buyNumber: buyNumber,
      cancelNumber: cancelNumber,
      updateNumberCallback: updateNumberCallback,
      searchMessage: searchMessage,
      searchMessageByIds: searchMessageByIds,
      searchMessagesByRecipient: searchMessagesByRecipient,
      searchRejections: searchRejections
    };
  };

  /**
   * Module exports
   */
  module.exports = Nexmo;
})();