<script setup lang="ts">
/** Feature 006: the release-1 invitations page moved into the admin console. Old links forward there. */
definePageMeta({ layout: false, middleware: [() => navigateTo('/admin/invitations', { replace: true })] })
</script>

<template>
  <div />
</template>
