import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useBnetCharPicker() {
  const auth = useAuthStore()

  const characters = computed(() => auth.bnetCharacters)

  const hasCharacters = computed(() => characters.value.length > 0)

  function pickCharacter(index: number) {
    const char = characters.value[index]
    if (!char) return null
    return {
      name: char.name,
      className: char.className,
    }
  }

  return {
    characters,
    hasCharacters,
    pickCharacter,
  }
}
