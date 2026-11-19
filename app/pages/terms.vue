<script setup lang="ts">
/** Terms · complete Arabic document (6:82). T024. */
import { TERMS } from '~/content/legal'
definePageMeta({ layout: false })
</script>

<template>
  <LegalDocument :doc="TERMS" current="terms" />
</template>
