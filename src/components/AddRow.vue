<script setup>
/** "+ Add …" row at the end of a list */
import AppIcon from './AppIcon.vue';

defineProps({ label: { type: String, required: true } });
defineEmits(['add']);
</script>

<template>
  <li>
    <button type="button" class="row row--add" @click="$emit('add')">
      <span class="add-circle"><span><AppIcon name="plus" :size="16" /></span></span>
      <span>{{ label }}</span>
    </button>
  </li>
</template>
