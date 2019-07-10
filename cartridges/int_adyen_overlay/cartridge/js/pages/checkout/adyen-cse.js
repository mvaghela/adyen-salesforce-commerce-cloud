    /* eslint-disable */
    'use strict';

    var util = require('./util'),
        ajax = require('./ajax');

    function pad(number) {
        if (number < 10) {
            return '0' + number;
        }
        return number;
    }
    
    var threeDS2utils = require('./threeds2-js-utils');
    /**
     * @function
     * @description Initializes Adyen Secured Fields  Billing events
     */
    function initializeBillingEvents() {
        var isOneClick = false;
        $('#billing-submit').on('click', function (e) {
            var radioVal = $('.payment-method-options').find(':checked').val();
            if ('CREDIT_CARD' == radioVal) {

                if (!window.CardValid) {
                    return false;
                }
                clearCardData();
                var oneClickCard = window.AdyenOneClick;
                setBrowserData();
                if (isOneClick) {
                    $('#dwfrm_billing_paymentMethods_creditCard_selectedCardID').val($('#adyenCreditCardList option:selected').attr('id'));
                    $('#dwfrm_billing_paymentMethods_creditCard_type').val($('#adyenCreditCardList option:selected').val());
                    $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedSecurityCode').val(oneClickCard.state.data.encryptedSecurityCode);
                }
                else {
                    $('#dwfrm_billing_paymentMethods_creditCard_selectedCardID').val("");
                    copyCardData(window.AdyenCard);
                }
            }	
            else if (radioVal == "Adyen"){	
                var selectedMethod = $('[name="brandCode"]:checked').val();	
                return componentDetailsValid(selectedMethod);	
            }
                
            e.preventDefault();
            $('.form-data-error').html('');
            $('#billing-submit-hidden').trigger('click');
        });

        $('#adyenCreditCardList').on('change', function () {
        	var selectedCard = $('#adyenCreditCardList').val();
        	var AdyenCheckoutObject = new AdyenCheckout(window.Configuration);
        	if(window.AdyenOneClick){
        		window.AdyenOneClick.unmount();
        	}
        	initializeOneClick(AdyenCheckoutObject, selectedCard);
        	window.CardValid = false;
            if (selectedCard !== "") {
                isOneClick = true;
                $("#selectedCard").slideDown("slow");
                $("#newCard").slideUp("slow");
                
            }
            else {
                isOneClick = false;
                $("#selectedCard").slideUp("slow");
                $("#newCard").slideDown("slow");
            }
        });
    }
    
    function initializeOneClick(AdyenCheckoutObject, selectedCard) {
    	var hideCVC = false;
    	if(selectedCard == "bcmc"){
    		hideCVC = true;
    	}
    	
	    var cardNode = document.getElementById('oneClickCard');
        window.AdyenOneClick = AdyenCheckoutObject.create('card', {
            // Mandatory fields
            type: selectedCard,
            details: (selectedCard == "bcmc") ? [] : [{"key": "cardDetails.cvc", "type": "cvc"}],
            oneClick: true, //<--- enable oneClick 'mode'
            hideCVC: hideCVC,
            storedDetails: {
                "card": {
                    "expiryMonth": "",
                    "expiryYear": "",
                    "holderName": "",
                    "number": ""
                }
            },
            // Events
            onChange: function(state) {
                // checks whether card was valid then was changed to be invalid
            	if(selectedCard == "maestro"){
            		window.CardValid = true;
            	}
            	else {
            		window.CardValid = state.isValid;
            	}
            }
        });
        window.AdyenOneClick.mount(cardNode);
    }
    
    function parseOpenInvoiceComponentData(state) {
    	$('#dwfrm_adyPaydata_dateOfBirth').val(state.data.personalDetails.dateOfBirth);
    	$('#dwfrm_adyPaydata_telephoneNumber').val(state.data.personalDetails.telephoneNumber);
    	$('#dwfrm_adyPaydata_gender').val(state.data.personalDetails.gender);
    }
    
    //Check the validity of checkout component	
    function componentDetailsValid(selectedMethod){	
    	//set data from components	
    	switch(selectedMethod) {
    	  case "ideal":
    		  if (idealComponent.componentRef.state.isValid) {	
                  $('#dwfrm_adyPaydata_issuer').val(idealComponent.componentRef.state.data.issuer);
              }	
              return idealComponent.componentRef.state.isValid;
    	    break;
    	  case "klarna":
    		  if (klarnaComponent.componentRef.state.isValid) {	
    			  parseOpenInvoiceComponentData(klarnaComponent.componentRef.state);
                  if($('#ssnValue')){
                      $('#dwfrm_adyPaydata_socialSecurityNumber').val($('#ssnValue').val());
                  }
    		  }
    		  
    		  return klarnaComponent.componentRef.state.isValid;
    		break;
    	  case "afterpay":
    		  if (afterpayComponent.componentRef.state.isValid) {
    			  parseOpenInvoiceComponentData(afterpayComponent.componentRef.state);
    		  }
    		  return afterpayComponent.componentRef.state.isValid;
      	    break;
    	  default:
    	    return true;
    	} 	
    }

    function copyCardData(card) {
        $('#dwfrm_billing_paymentMethods_creditCard_type').val(card.state.brand);
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedCardNumber').val(card.state.data.encryptedCardNumber);
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedExpiryMonth').val(card.state.data.encryptedExpiryMonth);
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedExpiryYear').val(card.state.data.encryptedExpiryYear);
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedSecurityCode').val(card.state.data.encryptedSecurityCode);
        $('#dwfrm_billing_paymentMethods_creditCard_owner').val(card.state.data.holderName);
    }
    
    function clearCardData() {
        $('#dwfrm_billing_paymentMethods_creditCard_type').val("");
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedCardNumber').val("");
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedExpiryMonth').val("");
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedExpiryYear').val("");
        $('#dwfrm_billing_paymentMethods_creditCard_adyenEncryptedSecurityCode').val("");
        $('#dwfrm_billing_paymentMethods_creditCard_owner').val("");
    }
    
    function setBrowserData() {
        var browserData = threeDS2utils.getBrowserInfo();
        $('#dwfrm_billing_paymentMethods_creditCard_browserInfo').val(JSON.stringify(browserData));
    };

    /**
     * @function
     * @description Initializes Adyen CSE My Account events
     */
    function initializeAccountEvents() {
        $('#add-card-submit').on('click', function (e) {
        	e.preventDefault();
            if (window.AdyenCard.isValid) {
            	copyCardData(window.AdyenCard);
                setBrowserData();
            	$('#add-card-submit-hidden').trigger('click');
            }
        });
    }


    /**
     * If selectedCard is used do not encrypt the number and holderName field
     * @param selectedCard
     * @returns
     */
    function getCardData(selectedCard) {

        var cardData = {
            cvc: $('#creditCard_cvn').val(),
            expiryMonth: $('#creditCard_expiration_month').val(),
            expiryYear: $('#creditCard_expiration_year').val(),
            generationtime: $('#adyen_generationtime').val()
        };

        if (!selectedCard) {
            cardData.number = $('#creditCard_number').val();
            cardData.holderName = $('#creditCard_owner').val();
        }

        return cardData;
    }

    function maskValue(value) {
        if (value && value.length > 4) {
            return value.replace(/\d(?=\d{4})/g, '*');
        } else {
            return '';
        }
    }

/**
 * @function
 * @description Initializes Adyen CSE billing events
 */

exports.initBilling = function() {
	initializeBillingEvents();
};    

exports.initAccount = function() {
	initializeAccountEvents();
};


