'use strict';

/* API Includes */
var URLUtils = require('dw/web/URLUtils');
var PaymentMgr = require('dw/order/PaymentMgr');
var Resource = require('dw/web/Resource');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');

/* Script Modules */
var app = require(Resource.msg('scripts.app.js', 'require', null));
var Cart = require(Resource.msg('script.models.cartmodel', 'require', null));
var AdyenHelper = require('int_adyen_overlay/cartridge/scripts/util/AdyenHelper');

/**
 * Creates a Adyen payment instrument for the given basket
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);
    var adyenRemovePreviousPI = require('int_adyen_overlay/cartridge/scripts/adyenRemovePreviousPI');
    var result;

    Transaction.wrap(function () {
        result = adyenRemovePreviousPI.removePaymentInstruments(args.Basket);
    });

    if (result === PIPELET_ERROR) {
        return {error: true};
    }
    var creditCardForm = app.getForm('billing.paymentMethods.creditCard');
    var tokenID = AdyenHelper.getCardToken(creditCardForm.get('selectedCardID').value(), customer);
    var cardType = creditCardForm.get('type').value();

    // create payment instrument
    Transaction.wrap(function () {
        cart.removeExistingPaymentInstruments(dw.order.PaymentInstrument.METHOD_CREDIT_CARD);
        var paymentInstrument = cart.createPaymentInstrument(dw.order.PaymentInstrument.METHOD_CREDIT_CARD, cart.getNonGiftCertificateAmount());

        paymentInstrument.creditCardHolder = creditCardForm.get('owner').value();
        paymentInstrument.creditCardType = cardType;

        if (!empty(tokenID)) {
            paymentInstrument.setCreditCardToken(tokenID);
        }
    });

    return {success: true};
}

/**
 * Call the  Adyen API to Authorize CC using details entered by shopper.
 */
function Authorize(args) {
    var order = args.Order;
    var paymentInstrument = args.PaymentInstrument;
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();

    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
    });

    // ScriptFile adyenCheckout.ds
    var adyenCheckout = require('int_adyen_overlay/cartridge/scripts/adyenCheckout');

    Transaction.begin();
    var result = adyenCheckout.creditCard({
        Order: order,
        CurrentSession: session,
        CurrentRequest: request,
        PaymentInstrument: paymentInstrument,
        CreditCardForm: app.getForm('billing.paymentMethods.creditCard'),
        SaveCreditCard: customer.authenticated && app.getForm('billing').object.paymentMethods.creditCard.saveCard.value,
        adyenForm : session.forms.adyPaydata
    });

    if (result.error) {
        Transaction.rollback();
        let args = 'args' in result ? result.args : null;

        return {
            error: true,
            PlaceOrderError: (!empty(args) && 'AdyenErrorMessage' in args && !empty(args.AdyenErrorMessage) ? args.AdyenErrorMessage : '')
        };
    }
    
    if(result.ThreeDS2){
        Transaction.commit();
        Transaction.wrap(function () {
            paymentInstrument.custom.adyenPaymentData = result.PaymentData;
        });

        session.custom.orderNo = order.orderNo;
        session.custom.paymentMethod = paymentInstrument.paymentMethod;

        return {
            authorized: true,
            authorized3d: true,
            view : app.getView({
            	ContinueURL: URLUtils.https('Adyen-Redirect3DS2', 'utm_nooverride', '1'),
            	Basket: order,
            	resultCode: result.resultCode,
                token3ds2: result.token3ds2
            })
        }
    }

    if(result.RedirectObject != ''){
	    if(result.RedirectObject.url && result.RedirectObject.data.PaReq && result.RedirectObject.data.MD){
	        Transaction.commit();
	        if(result.PaymentData){
	            Transaction.wrap( function() {
	            	paymentInstrument.custom.adyenPaymentData = result.PaymentData;
	            });
	        }
            session.custom.orderNo = order.orderNo;
            session.custom.paymentMethod = paymentInstrument.paymentMethod;
	        return {
	            authorized: true,
	            authorized3d: true,
	            redirectObject: result.RedirectObject,
	            view: app.getView({
	                ContinueURL: URLUtils.https('Adyen-CloseThreeDS', 'utm_nooverride', '1'),
	                Basket: order,
	                issuerUrl : result.RedirectObject.url,
	                paRequest : result.RedirectObject.data.PaReq,
	                md : result.RedirectObject.data.MD
	            })};
	    }
	    else{
	    	Logger.getLogger("Adyen").error("3DS details incomplete");
	    	 return {
	             error: true,
	             PlaceOrderError: ('AdyenErrorMessage' in result && !empty(result.AdyenErrorMessage) ? result.AdyenErrorMessage : '')
	         };
	    }
    }
	if (result.Decision != 'ACCEPT') {
        Transaction.rollback();
        return {
            error: true,
            PlaceOrderError: ('AdyenErrorMessage' in result && !empty(result.AdyenErrorMessage) ? result.AdyenErrorMessage : '')
        };
    }

    AdyenHelper.savePaymentDetails(paymentInstrument, order, result);

    Transaction.commit();

    return {authorized: true};
}

exports.Handle = Handle;
exports.Authorize = Authorize;