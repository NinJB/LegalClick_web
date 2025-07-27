/*******************************************************************************************************************/
/*Javascript for navigation bar*/
/*******************************************************************************************************************/

const unreg = Vue.createApp({
    template: `
        <div class="navbar__container">
            <!--Navigation bar-->
            <nav class="navbar" aria-label="Main navigation">
                <a href="/index.html"><img src="/images/logo.png" class="white-logo"></a>

                <!--Sign Up button-->
                <div class="navbar__item">
                    <button class="navbar__button" id="sign-up" aria-label="Signup Page">
                        <a href="/signup.html" class="navbar__link">Sign Up</a>
                    </button>
                </div>

                <!--Log In button-->
                <div class="navbar__item">
                    <button class="navbar__button" id="log-in" aria-label="Login Page">
                        <a href="/html/admins/login.html" class="navbar__link">Log In</a>
                    </button>
                </div>
            </nav>
        </div>
    `
});

/*Insert to client dashboard navigation*/
unreg.mount('.navigation');
/*******************************************************************************************************************/