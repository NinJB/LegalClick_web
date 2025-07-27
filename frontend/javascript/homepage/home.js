/*******************************************************************************************************************/
/*Javascript for homepage*/
/*******************************************************************************************************************/

const home = Vue.createApp({
    template: `
        <div class="homepage__container">
            <div class="homepage__welcome">
                <div class="homepage__first">
                    <h6 class="homepage__title">An AI-Powered Lawyer Matching and Online Consultation Platform</h6>
                    <h1 class="homepage__intro">Click into Justice with LegalClick</h1>
                    <h5 class="homepage__description">Every legal challenge is unique. Get personalized legal support that fits your case.</h5>
                </div>

                <div class="homepage__second">
                </div>
            </div>

            <div class="homepage__partnership">
                <div class="homepage__partner--container">
                    <h1 class="homepage__text">IN PARTNERSHIP WITH</h1>
                    <div class="homepage__partners">
                        <div class="homepage__partners--container">
                            <img src="/images/OLBA-logo.jpg" class="homepage__partners--img">
                            <p>OCCIDENTAL LEYTE BAR ASSOCIATION</p>
                        </div>

                        <div class="homepage__partners--container">
                            <img src="/images/PAO-logo.png" class="homepage__partners--img">
                            <p>PUBLIC ATTORNEY'S OFFICE - Ormoc Chapter</p>
                        </div>

                        <div class="homepage__partners--container">
                            <img src="/images/IBP-logo.png" class="homepage__partners--img">
                            <p>INTEGRATED BAR OF THE PHILIPPINES</p>
                        </div>
                    </div>
                    <h1 class="homepage__text">TO DELIVER PROFESSIONAL & TRUSTWORTHY LEGAL SERVICES</h1>
                </div>
            </div>

            <div class="homepage__information--wrapper">
            <div class="box">
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            <div class="homepage__information">
                <div class="homepage__information--container">
                    <h1 class="homepage__title--about">About LegalClick</h1>
                    <p class="homepage__text--about">LegalClick aims to make legal solutions more accessible and efficient by connecting individuals with trusted legal professionals online.</p>
                    <div class="homepage__info">
                        <h3 class="homepage__subtitle--about">Our Mission</h3>
                        <ul>
                            <li>We bridge the gap between clients and legal professionals through this innovative digital platform.</li>
                            <li>Empower individuals and communities by making legal solutions more accessible and efficient.</li>
                            <li>Assist clients through AI in selecting licensed Attorneys in Ormoc City.</li>
                        </ul>
                    </div>
                    <div class="homepage__info">
                        <h3 class="homepage__subtitle--about">Our Vision</h3>
                        <ul>
                            <li>We envision a future where everyone—regardless of location or background—can connect with trusted legal professionals instantly, confidently, and securely.</li>
                            <li>To be the first digital platform revolutionizing access to legal services within Ormoc City.</li>
                        </ul>
                    </div>
                    <div>
                        <h3>Who is LegalClick for?</h3>
                        <div class="homepage__users">
                            <div class="homepage__people">Citizens</div>
                            <div class="homepage__people">Lawyers</div>
                        </div>
                    </div>
                </div>

                <div class="homepage__information--container">
                    <img src="/images/map-ormoc.jpg" class="map-image">
                </div>
            </div>
            </div>
        </div>

        <footer>
            <div class="homepage__contact-us">
                <h2>Contact Us</h2>
                <p>If you have any questions or need legal assistance, feel free to reach out.</p>
                <ul class="contact-info">
                <li><strong>Email:</strong> support@legalclick.com</li>
                <li><strong>Phone:</strong> (+63) 938 677 5983</li>
                <li><strong>Address:</strong> Ormoc City, Leyte, Philippines 6541</li>
                </ul>
                <div class="footer-bottom">
                &copy; 2025 LegalClick. All rights reserved.
                </div>
            </div>
        </footer>
    `
});

/*Insert to "nav-head" of html files except products.html since I already integrated it in store.js*/
home.mount('.home');
/*******************************************************************************************************************/