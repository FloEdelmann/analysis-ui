import get from 'lodash/get'
import {
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {v4 as uuid} from 'uuid'

import FormContext from 'lib/contexts/controlled-form'

const alwaysValid = (p: any, r?: any) => true // eslint-disable-line
const identityFn = (v) => v

// Is this the value itself or an event?
function getRawValueFromInput(input) {
  const isEvent =
    get(input, 'target.value') != null ||
    input instanceof Event ||
    get(input, 'nativeEvent') instanceof Event

  if (isEvent) {
    const target = input.target
    if (target.type === 'checkbox') return target.checked
    return target.value
  } else {
    return input
  }
}

type ControlledInput = {
  onBlur: () => void
  onFocus: (e: SyntheticEvent) => void
  onChange: (input: any) => Promise<void>
  id: string
  isInvalid: boolean
  isValid: boolean
  ref: any
  value: any
}

/**
 * Helper hook for allowing controlled inputs that can frequently update but not slow down the interface.
 */
export default function useControlledInput({
  onChange = identityFn,
  id = null,
  parse = identityFn,
  test: checkValid = alwaysValid,
  value
}): ControlledInput {
  const form = useContext(FormContext)
  const [inputValue, setInputValue] = useState(value)
  const [isValid, setIsValid] = useState(() =>
    checkValid(parse(inputValue), inputValue)
  )
  const ref = useRef<any>()

  // Generate ids when they do not exist
  const autoId = useMemo(() => id || uuid(), [id])

  // Update the value from the external source on change unless the input is
  // currently the active element.
  useEffect(() => {
    if (ref.current !== document.activeElement) {
      setInputValue(value)
      setIsValid(checkValid(parse(value), value))
    }
  }, [parse, ref, setInputValue, checkValid, value])

  // Get the value from the Input, parse it, test it, and then pass then parsed
  // value to the original onChange function. This keeps the input in sync.
  const inputOnChange = useCallback(
    async (input) => {
      const rawValue = getRawValueFromInput(input)
      // Ensure the displayed value syncs fast, even if it's not valid
      setInputValue(rawValue)
      const parsedValue = parse(rawValue)
      const isValid = checkValid(parsedValue, rawValue)
      setIsValid(isValid)
      // Don't pass invalid changes through to the onChange function
      if (!isValid) return
      // Allow the sync to occur before propogating the change
      await onChange(parsedValue)
    },
    [onChange, parse, setInputValue, setIsValid, checkValid]
  )

  // Revert to previous value if current value is invalid
  const onBlur = useCallback(() => {
    if (!isValid && checkValid(parse(value), value)) {
      setInputValue(value)
      setIsValid(true)
    }
  }, [checkValid, isValid, parse, value])

  // On input focus select all of the text by default
  const onFocus = useCallback((e) => e.target.select(), [])

  return {
    onBlur,
    onChange: inputOnChange,
    onFocus,
    id: autoId,
    isInvalid: !isValid,
    isValid,
    ref,
    value: inputValue
  }
}
