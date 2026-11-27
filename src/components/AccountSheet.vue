<script setup>
/** Account sheet: email, sync status, password reset, logging out */
import { computed, onMounted, ref } from 'vue';
import { t, getLanguage } from '../js/i18n.js';
import { auth, resetPassword } from '../js/firebase.js';
import { syncState, authErrorKey, logOutAndClear } from '../js/account.js';
import { sheets } from '../js/sheets.js';

const dialog = ref(null);
const email = ref('');

const status = computed(() => {
  if (!syncState.value.pending) return t('account.synced');
  return syncState.value.online ? t('account.syncing') : t('account.offline');
});

onMounted(() => {
  sheets.account = () => {
    email.value = auth.currentUser?.email ?? '';
    dialog.value.showModal();
  };
});

async function reset() {
  try {
    await resetPassword(email.value, getLanguage());
    alert(t('auth.resetSent', { email: email.value }));
  } catch (error) {
    alert(t(authErrorKey(error)));
  }
}

async function logOut() {
  if (!confirm(t(syncState.value.pending ? 'account.logOutPending' : 'account.logOutConfirm'))) return;
  await logOutAndClear();
}
</script>

<template>
  <dialog id="account-dialog" ref="dialog" autofocus tabindex="-1" class="sheet">
    <div class="sheet__head">
      <span />
      <strong>{{ t('account.title') }}</strong>
      <button type="button" class="link link--bold" @click="dialog.close()">{{ t('action.done') }}</button>
    </div>
    <div class="sheet__body">
      <ul class="group">
        <li class="row account__row">
          <span class="row__body">
            <span class="row__title">{{ email }}</span>
            <span class="row__sub">{{ status }}</span>
          </span>
        </li>
      </ul>
      <ul class="group group--spaced">
        <li><button type="button" class="row row--add" @click="reset">{{ t('account.resetPassword') }}</button></li>
      </ul>
      <p class="footnote">{{ t('account.resetNote') }}</p>
      <button type="button" class="btn btn--danger btn--block" @click="logOut">{{ t('account.logOut') }}</button>
    </div>
  </dialog>
</template>
