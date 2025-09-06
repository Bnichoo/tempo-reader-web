import React, { useMemo } from "react";
import { useSearchIndex } from "../../hooks/useSearchIndex";
import { SearchDrawer } from "../../components/SearchDrawer";

type Props = {
  tokens: string[];
  search: string;
  setSearch: (s: string) => void;
  drawerOffsetLeft: number;
  onGoToToken: (ti: number) => void;
};

export const SearchController: React.FC<Props> = ({ tokens, search, setSearch, drawerOffsetLeft, onGoToToken }) => {
  const idx = useSearchIndex(tokens);
  const hits = useMemo(() => idx.search(search, 200), [idx, search]);
  const open = search.trim().length >= 2;
  return (
    <SearchDrawer
      open={open}
      query={search}
      hits={hits}
      onClose={() => setSearch("")}
      onGoToToken={onGoToToken}
      drawerOffsetLeft={drawerOffsetLeft}
    />
  );
};

