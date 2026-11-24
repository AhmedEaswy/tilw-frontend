<script setup lang="ts">
/** Feature 006: the release-1 admin waitlist moved into the admin console. Old links forward there. */
definePageMeta({ layout: false, middleware: [() => navigateTo('/admin/waitlist', { replace: true })] })
</script>

<template>
  <div />
</template>
