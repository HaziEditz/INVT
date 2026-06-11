import { useEffect, useRef } from 'react';
import { attachPlacesAutocompleteAsync } from '@/lib/geocoder';
import type { PlaceValue } from '@/lib/createJobForm';
import { cn } from '@/lib/utils';

interface AddressAutocompleteProps {
  mapsKey: string;
  active: boolean;
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  onPlace: (place: PlaceValue) => void;
  className?: string;
  invalid?: boolean;
}

export function AddressAutocomplete({
  mapsKey,
  active,
  value,
  placeholder,
  onChange,
  onPlace,
  className = 'bw-field',
  invalid = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onPlaceRef = useRef(onPlace);
  const placeSelectingRef = useRef(false);
  onPlaceRef.current = onPlace;

  useEffect(() => {
    const input = inputRef.current;
    if (!active || !mapsKey || !input) return;

    let detach = () => {};
    attachPlacesAutocompleteAsync(input, mapsKey, (place) => {
      placeSelectingRef.current = true;
      onPlaceRef.current(place);
      placeSelectingRef.current = false;
    }).then((fn) => {
      detach = fn;
    });

    return () => detach();
  }, [active, mapsKey]);

  return (
    <input
      ref={inputRef}
      type="text"
      className={cn(className, invalid && '!border-red-500 !border-2')}
      placeholder={placeholder}
      value={value}
      autoComplete="off"
      onChange={(e) => {
        if (placeSelectingRef.current) return;
        onChange(e.target.value);
      }}
    />
  );
}
