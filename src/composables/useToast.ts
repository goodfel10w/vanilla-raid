import { ref } from 'vue'

const toastMessage = ref('')
const toastVisible = ref(false)
let timer: ReturnType<typeof setTimeout>

export function useToast() {
  function toast(msg: string) {
    toastMessage.value = msg
    toastVisible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      toastVisible.value = false
    }, 2200)
  }

  return {
    message: toastMessage,
    visible: toastVisible,
    toast,
  }
}
