// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import { CookieStorage } from "aws-amplify/utils";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import "./App.css";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID,
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      loginWith: {
        oauth: {
          domain: process.env.REACT_APP_USER_POOL_AUTH_DOMAIN,
          scope: process.env.REACT_APP_USER_POOL_SCOPES.split(","),
          redirectSignIn: `https://${window.location.hostname}${process.env.REACT_APP_USER_POOL_REDIRECT_PATH_SIGN_IN}`,
          redirectSignOut: `https://${window.location.hostname}${process.env.REACT_APP_USER_POOL_REDIRECT_PATH_SIGN_OUT}`,
          responseType: "code",
        },
      },
    },
  },
});

cognitoUserPoolsTokenProvider.setKeyValueStorage(
  new CookieStorage({
    domain: process.env.REACT_APP_COOKIE_DOMAIN,
    expires: null, // null means session cookies
    path: "/",
    secure: true, // for developing on localhost over http: set to false
    sameSite: "lax",
  })
);

const App = () => {
  const [state, setState] = useState({
    email: undefined,
    username: undefined,
    authenticated: undefined,
  });

  useEffect(() => {
    fetchAuthSession()
      .then((user) =>
        setState({
          username: user.username,
          email: user.tokens.idToken.payload.email,
          authenticated: true,
        })
      )
      .catch(() => setState({ authenticated: false }));
    // Schedule check and refresh (when needed) of JWT's every 5 min:
    const i = setInterval(() => fetchAuthSession(), 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  if (state.authenticated === undefined) {
    return (
      <div className="App">
        <p className="explanation">One moment please ...</p>
      </div>
    );
  }

  if (state.authenticated === false) {
    return (
      <div className="App">
        <h1>Signed out</h1>
        <p className="explanation-tight">You're signed out.</p>
        <p className="explanation-tight">
          You're able to view this page, because it is in your browser's local
          cache––you didn't actually download it from CloudFront just now.
          Authorization@Edge wouldn't allow that.
        </p>
        <p className="explanation-tight">
          If you force your browser to reload the page, you'll trigger
          Authorization@Edge again, redirecting you to the login page:&nbsp;
          <button onClick={() => window.location.reload(true)}>
            Reload page
          </button>
        </p>
        <p className="explanation-tight">
          If you never want to cache content, set the right cache headers on the
          objects in S3; those headers will be respected by CloudFront and web
          browsers:
          <pre>Cache-Control: no-cache</pre>
          At the expense of some performance for end-users of course.
        </p>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Private</h1>

      <p className="explanation">
        Welcome <strong>{state.email || state.username}</strong>. You are signed
        in!
      </p>

      <p className="explanation">
        If you are able to come here, it means everything was deployed in order.
        Amongst other things, you've deployed a CloudFront distribution that
        you're viewing right now.
      </p>

      <h4>What just happened:</h4>

      <ol className="explanation-points">
        <li>
          You just signed-in at the Cognito Hosted UI. You were redirected there
          by a Lambda@Edge function; it detected you had not yet authenticated.
        </li>
        <li>
          After sign-in you were redirected back by Cognito to your Cloudfront
          distribution. Another Lambda@Edge function handled that redirect and
          traded the authorization code for JWT's and stored these in your
          cookies.
        </li>
        <li>
          After that, the Lambda@Edge redirected you back to the URL you
          originally requested. This time you have valid JWT's in your cookies
          so you were allowed access, and here you are.
        </li>
      </ol>

      <h3>Good job!</h3>

      <p className="explanation">
        The page you're viewing right now is served from S3 (through
        CloudFront). You can upload your own SPA (React, Angular, Vue, ...) to
        the S3 bucket instead and thus instantly secure it with Cognito
        authentication. If your SPA uses AWS Amplify framework with cookie
        storage for Auth, the detection of the sign-in status in the SPA will
        work seamlessly, because the Lambda@Edge setup uses the same cookies. Of
        course your SPA needs to be made aware of the right&nbsp;
        <span className="config">
          config
          <span className="config-text">
            {`Amplify.configure({
Auth: {
  Cognito: {
    userPoolClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID,
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    loginWith: {
      oauth: {
        domain: process.env.REACT_APP_USER_POOL_AUTH_DOMAIN,
        scope: process.env.REACT_APP_USER_POOL_SCOPES.split(","),
        redirectSignIn: "https://${window.location.hostname}${process.env.REACT_APP_USER_POOL_REDIRECT_PATH_SIGN_IN}",
        redirectSignOut: "https://${window.location.hostname}${process.env.REACT_APP_USER_POOL_REDIRECT_PATH_SIGN_OUT}",
        responseType: "code",
      }
    }
  },
}
});
cognitoUserPoolsTokenProvider.setKeyValueStorage(new CookieStorage({
  domain: process.env.REACT_APP_COOKIE_DOMAIN,
  expires: null, // null means session cookies
  path: "/",
  secure: true, // for developing on localhost over http: set to false
  sameSite: "lax",
}));`}
          </span>
        </span>
        .
      </p>

      <p className="explanation">
        Take a look at your cookies (open the developer panel in your browser)
        and you'll see a couple of JWT's there. Try clearing these cookies and
        reload the page, then you'll have to sign in again––unless you are still
        signed in at the Cognito hosted UI, in which case you would be
        redirected back here seamlessly with new JWT's.
      </p>

      <p className="explanation">
        To sign-out both locally (by clearing cookies) as well as at the Cognito
        hosted UI, use the sign-out button:{" "}
        <button onClick={async () => await signOut()}>Sign out</button>. That uses Amplify
        to sign out. Alternatively, sign out using Lambda@Edge by explicitly
        visiting the sign-out URL:{" "}
        <a href={process.env.REACT_APP_SIGN_OUT_URL}>Sign Out</a>.
      </p>

      <p className="explanation">
        Now that you're signed in, you can access any file in the protected S3
        bucket, directly through the URL. For example, open this AWS SAM
        introduction image:{" "}
        <a href="aws_sam_introduction.png" target="_blank">
          link
        </a>
        . If you open the link, your browser will automatically send the cookies
        along, allowing Cloudfront Lambda@Edge to inspect and validate them, and
        only return you that image if the JWT's in your cookies are indeed still
        valid. Try clearing your cookies again and then open the link,
        Lambda@Edge will then redirect you to the Cognito hosted UI. After
        sign-in there (you may still be signed in there) you will be redirected
        back to the link location.
      </p>
    </div>
  );
};

export default App;
