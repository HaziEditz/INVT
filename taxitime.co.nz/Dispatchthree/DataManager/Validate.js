$(function () {
    /*-------------------------------------------------------
   ---------------- `Form Validation` -----------
   ----------------------------------------------------------*/
    $message = "<span class='fa fa-exclamation-circle form-control-feedback validate' style='font-size:22px'></span>";
    $("input[data-error], select[data-error], textarea[data-error], .field-control").focusout(function () {
        $val = $(this).val();
        if ($val.length >= 1) {
            $container = $(this).closest('div');
            $(this).removeClass("border-color");
            $tool = $(this).closest("div");
            $toolcont = $(this).closest("div").prev().closest("div");
            $(tooltip).find(".tooltip-error-message").remove();
            $($container).find(".fa.fa-exclamation-circle").remove();
        } else {
            $container = $(this).closest('div');
            $($container).find(".fa.fa-exclamation-circle").remove();
            $(this).addClass("border-color");
            $tool = $(this).closest("div");
            $toolcont = $(this).closest("div").prev().closest("div");
            $(tooltip).find(".tooltip-error-message").remove();
            $($container).append($message);
        }
    });
    $("input[data-error], select[data-error], textarea[data-error], .field-control").focusin(function () {
        $text = $(this).data("error");
        $container = $(this).closest('div');
        if ($($container).find("span").is(".fa.fa-exclamation-circle")) {
            $(this).removeClass("border-color");
            $($container).find(".fa.fa-exclamation-circle").remove();
            if ($(this).is("input[data-error]")) {
                $tool = $(this).closest("div");
                $toolcont = $(this).closest("div").prev().closest("div");
                $(tooltip).find(".tooltip-error-message").remove();
                $(tooltip($text)).appendTo($tool);
                $(tooltip).find(".tooltip-error-message").fadeIn();
            }
        } else {
            return false;
        }
    });
    /*-------------------------------------------------------
   ---------------- `Closing Toast And Adding Toast` -----------
   ----------------------------------------------------------*/
    $(document).on("click", ".close.cl-toast", function () {
        $(".message-toast-success, .message-toast-error").removeClass("fadendown");
    });
    $("body").append(toast("message-toast-success", "text-toast-success", ""));
});

/*-------------------------------------------------------
   ---------------- `Form Validation` -----------
   ----------------------------------------------------------*/
function tooltip(text) {
    $tooltip = "<div class='tooltip-error-message'>" +
        "<div class='validate-message'>" +
        "<span class='text-icon-error'><span class='fa fa-exclamation'></span></span> <span class='text-message'>" + text + "</span>" +
        "</div></div>";
    return $tooltip;
}
var result = 0;
function IsValid(CForm) {
    $btn_val = $(CForm).val();
    $(CForm).val('');
    $(CForm).attr("disabled", "disabled");
    $(CForm).closest("div").append(waitLoader());
    var Form = $(CForm).closest("form").attr("id");
    $("#" + Form + " input[data-error], #" + Form + " select[data-error], #" + Form + " textarea[data-error]").each(function (k, e) {
        $val = $(e).val();
        $len = $val.length;
        if ($len <= 0) {
            $container = $(e).closest('div');
            $($container).find(".fa.fa-exclamation-circle").remove();
            $(e).addClass("border-color");
            $($container).append($message);
            result++;
        }
    });
    if (result == 0) {
        $(CForm).removeAttr("disabled");
        $(CForm).closest("div").find(".spinner").remove();
        $(CForm).val($btn_val);
        return Boolean(true);
    } else {
        $(CForm).removeAttr("disabled");
        $(CForm).closest("div").find(".spinner").remove();
        $(CForm).val($btn_val);
        result = 0;
        return Boolean(false);
    }
}
/*-------------------------------------------------------
   ---------------- `Toast` -----------
   ----------------------------------------------------------*/
function toast(cl1, cl2, text) {
    $toast = "<div class='container " + cl1 + "'>" +
         "<button type='button' class='close cl-toast'>&times;</button>" +
        "<h4 class='" + cl2 + "'><i class='fa' style='margin-right:12px;font-size:1.4em'></i><span>" + text + "</span></h4>" +
    "</div>";

    return $toast;
}
//function ErrMessage(text) {
//    $("body").find(".message-toast-success").removeClass("message-toast-success").addClass("message-toast-error");
//    $(".message-toast-error h4 span").text(text);
//    $(".message-toast-error h4 i").addClass("fa-times-circle");
//    $("body").find(".message-toast-error").addClass("fadendown");
//    setTimeout(function () {
//        $("body").find(".message-toast-error").removeClass("fadendown");
//    }, 6000);
//}
//function SuccMessage(text) {
//    $("body").find(".message-toast-error").removeClass("message-toast-error").addClass("message-toast-success");
//    $(".message-toast-success h4 span").text(text);
//    $(".message-toast-success h4 i").addClass("fa-check-circle");
//    $("body").find(".message-toast-success").addClass("fadendown");
//    setTimeout(function () {
//        $("body").find(".message-toast-success").removeClass("fadendown");
//    }, 6000);
    
//    //$("input[type=text]").val("");
//    //$("select").val("");
//}

/*-------------------------------------------------------
   ---------------- `Wait Loader/Spinner` -----------
   ----------------------------------------------------------*/
function waitLoader()
{
    return '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
}

toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-top-right",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "5000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "slideDown",
    "hideMethod": "slideUp"
}

function ErrMessage(text) {
    toastr["error"](text, 'Error!');
}
function SuccMessage(text) {
    console.log(text);
    if (text == "Record Already Exists" || text == "Operation Not Successfully Performed") {
       

       // Swal.fire(
       //  'Error',
       //  text,
       //  'Error'
       //)
        //alert("  (" + (text) + ")");
       
    }
    else if(text=="Error") {
       
        //alert("Your page is refreshing because of    (" + (text) + ")");
    }
    else {
      
        //alert(" (" + (text) + ")");
        Result(text);
    }
    //$("input[type=text]").val("");
    //$("select").val("");
}

 