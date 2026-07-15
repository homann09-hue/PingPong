/* Aurora background Web Push worker. Firebase client identifiers are supplied
   in the registered worker URL by the compiled Flutter client. */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const parameters = new URL(self.location.href).searchParams;
const configuration = Object.fromEntries(parameters.entries());

if (configuration.apiKey && configuration.appId &&
    configuration.messagingSenderId && configuration.projectId) {
  firebase.initializeApp(configuration);
  firebase.messaging();
}
