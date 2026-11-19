<script setup lang="ts">
/** Privacy · complete Arabic document (6:81). T024. */
import { PRIVACY } from '~/content/legal'
definePageMeta({ layout: false })
</script>

<template>
  <LegalDocument :doc="PRIVACY" current="privacy" />
</template>
