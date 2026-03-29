import { FC, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface DifficultyGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DifficultyGuideDialog: FC<DifficultyGuideDialogProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      onOpenChange(false);
      navigate("/guida-difficolta-trekking");
    }
  }, [open, onOpenChange, navigate]);

  return null;
};
