import '@gorhom/bottom-sheet';

// Props added by `cssInterop(GorhomBottomSheet, ...)` in app/(tabs)/map.tsx.
declare module '@gorhom/bottom-sheet' {
  interface BottomSheetProps {
    backgroundClassName?: string;
    handleIndicatorClassName?: string;
  }
}
