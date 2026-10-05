import { ulid } from 'ulidx'

/** Nové ID záznamu (ULID – časovo zoraditeľné, 26 znakov). */
export const newId = (): string => ulid()
