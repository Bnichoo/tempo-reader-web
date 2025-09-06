 
import AppShell from "./AppShell";
import { DocumentProvider } from "./contexts/DocumentContext";
import { ReaderProvider } from "./contexts/ReaderContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ClipsProvider } from "./contexts/ClipsContext";
import { SelectionProvider } from "./contexts/SelectionContext";

export default function App() {
  return (
    <DocumentProvider>
      <SettingsProvider>
        <ReaderProvider>
          <ClipsProvider>
            <SelectionProvider>
              <AppShell />
            </SelectionProvider>
          </ClipsProvider>
        </ReaderProvider>
      </SettingsProvider>
    </DocumentProvider>
  );
}
