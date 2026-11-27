<script setup>
/** Sign in or create an account */
import { reactive, ref } from 'vue';
import { t, getLanguage } from '../js/i18n.js';
import { signIn, signUp, resetPassword } from '../js/firebase.js';
import { authErrorKey } from '../js/account.js';

const form = reactive({ email: '', password: '' });
const signingUp = ref(false);
const error = ref('');
const busy = ref(false);

function toggleMode() {
  signingUp.value = !signingUp.value;
  error.value = '';
}

async function submit() {
  const email = form.email.trim();
  if (!email) { error.value = t('auth.err.email'); return; }
  if (signingUp.value && form.password.length < 6) { error.value = t('auth.err.weak'); return; }
  error.value = '';
  busy.value = true;
  try {
    await (signingUp.value ? signUp : signIn)(email, form.password);
    location.reload(); // start over with the user's data
  } catch (err) {
    console.error(err);
    error.value = t(authErrorKey(err));
    busy.value = false;
  }
}

async function reset() {
  const email = form.email.trim();
  if (!email) { error.value = t('auth.err.resetEmail'); return; }
  try {
    await resetPassword(email, getLanguage());
    error.value = '';
    alert(t('auth.resetSent', { email }));
  } catch (err) {
    error.value = t(authErrorKey(err));
  }
}
</script>

<template>
  <section id="view-auth" class="view">
    <form id="auth-form" class="auth" novalidate @submit.prevent="submit">
      <img class="empty-state__logo" src="icons/logo.svg" alt="" width="96" height="96">
      <h1 class="empty-state__title">Plate</h1>
      <p class="empty-state__text">{{ t('auth.text') }}</p>
      <ul class="group group--form auth__fields">
        <li class="form-row">
          <input
            v-model="form.email"
            name="email"
            class="form-row__full"
            type="email"
            inputmode="email"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            :placeholder="t('auth.email')"
            :aria-label="t('auth.email')"
          >
        </li>
        <li class="form-row">
          <input
            v-model="form.password"
            name="password"
            class="form-row__full"
            type="password"
            :autocomplete="signingUp ? 'new-password' : 'current-password'"
            :placeholder="t('auth.password')"
            :aria-label="t('auth.password')"
          >
        </li>
      </ul>
      <p v-if="error" id="auth-error" class="error" role="alert">{{ error }}</p>
      <button id="auth-submit" type="submit" class="btn btn--filled btn--block" :disabled="busy">{{ t(signingUp ? 'auth.signUp' : 'auth.signIn') }}</button>
      <button id="auth-switch" type="button" class="link" @click="toggleMode">{{ t(signingUp ? 'auth.toSignIn' : 'auth.toSignUp') }}</button>
      <button id="auth-reset" type="button" class="link" @click="reset">{{ t('auth.forgot') }}</button>
    </form>
  </section>
</template>
