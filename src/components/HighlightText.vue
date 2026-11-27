<script setup>
/** Text with search matches highlighted; ranges — [[start, end]…], positions in the text */
import { computed } from 'vue';
import { highlightParts } from '../js/searchbar.js';

const props = defineProps({ text: { type: String, required: true }, ranges: { type: Array, default: null } });
const parts = computed(() => highlightParts(props.text, props.ranges));
</script>

<template>
  <template v-for="(part, i) in parts" :key="i"><mark v-if="part.mark" class="hl">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
</template>
