$(document).ready(function () {
    function addInputNames() {
        // Not ideal, but jQuery's validate plugin requires fields to have names
        // so we add them at the last possible minute, in case any javascript 
        // exceptions have caused other parts of the script to fail.
        $(".card-number").attr("name", "card-number")
        $(".card-cvc").attr("name", "card-cvc")
        $(".card-expiry-year").attr("name", "card-expiry-year")
    }

    function removeInputNames() {
        $(".card-number").removeAttr("name")
        $(".card-cvc").removeAttr("name")
        $(".card-expiry-year").removeAttr("name")
    }

    $("#formStripe").submit(function () {
        //$('#btnPay').attr("disabled")
   
        document.getElementById('btnPay').style.display = 'none';
        if ($('#StripePublicKey').text() != "") {
            Stripe.setPublishableKey($('#StripePublicKey').text());
            // remove the input field names for security
            // we do this *before* anything else which might throw an exception
            removeInputNames(); // THIS IS IMPORTANT!

            // given a valid form, submit the payment details to stripe
            // $(form['submit-button']).attr("disabled", "disabled")

            Stripe.createToken({
                number: $('.card-number').val(),
                cvc: $('.card-cvc').val(),
                exp_month: $('.card-expiry-month').val(),
                exp_year: $('.card-expiry-year').val()
            }, function (status, response) {
                var percentage = document.getElementById("percentagevalue").value;
                var transectioon = document.getElementById("transection").value;
                var percentagefound = (parseFloat($('#TxAmount').val()) * parseFloat(percentage)) / 100;
                console.log(percentagefound);
                var percentageadded = parseFloat(percentagefound) + parseFloat($('#TxAmount').val());
                console.log(percentageadded)
                var transeadd = parseFloat(transectioon) + percentageadded;

                var amountz = transeadd * 100;
                var fulls = Math.ceil(transeadd);
                console.log(fulls);
                if (response.error) {
                    // re-enable the submit button
                    //$('#btnPay').removeAttr("disabled")
                    document.getElementById('btnPay').style.display = 'block';
                    // show the error
                    $(".payment-errors").html(response.error.message);

                    // we add these names back in so we can revalidate properly
                    addInputNames();
                } else {
                    //$('#btnPay').removeAttr("disabled")
                    // token contains id, last4, and card type
                    var token = response['id'];
                   
                    $('#paymentmodel').modal('hide');
                    document.getElementById('btnPay').style.display = 'block';
                 //alert(transeadd);
                    $.ajax({
                        url: "Default.aspx/DispatchChargeing",
                        type: "POST",
                         datatype: "json",
                        data: JSON.stringify({
                            "Token": token,
                            "Amout": fulls.toString()
                        }),
                      contentType: "application/json;charset/=utf-8",
                        success: FnSuccessPayment,
                        error: errorfn

                    });

                    // insert the stripe token
                    //var input = $("<input name='stripeToken' value='" + token + "' style='display:none;' />");
                   // form.appendChild(input[0]);
                   //  $('#stripeTOKEN').val(token);


                }
            });

            return false;
        }
        else {
            toastr["error"]("This Company Stripe Account Details not exists, Please add stripe account details in owner Panel", 'Not Found!');
        }
    });

    // add custom rules for credit card validating
    jQuery.validator.addMethod("cardNumber", Stripe.validateCardNumber, "Please enter a valid card number");
    jQuery.validator.addMethod("cardCVC", Stripe.validateCVC, "Please enter a valid security code");
    jQuery.validator.addMethod("cardExpiry", function () {
        return Stripe.validateExpiry($(".card-expiry-month").val(),
                                     $(".card-expiry-year").val())
    }, "Please enter a valid expiration");

                  
    addInputNames();
});
function FnSuccessPayment(result)
{
    console.log(result.d);    
    if (result.d == "succeeded") {
        document.getElementById('btnPay').style.display = 'block';
      

        Action([
         { "name": "PhoneNo", "Value": $('#TxMobileNo').val() }, { "name": "Amount", "Value": $('#TxAmount').val() }], "[InsertPassengerBalance]");
         
        angular.element(document.getElementById('myangular')).scope().paymentjob($('#TxAmount').val(), $('#Email').val(),$('#TxtName').val());
       
      

    }


    else {
        ErrMessage(result.d);
        console.log(result.d);
    }
    
}
function errorfn(result )
{
    console.log(result.d);
    ErrMessage("Error, Server is down OR internet connection problem");
}