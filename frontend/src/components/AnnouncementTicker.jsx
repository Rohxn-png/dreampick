export function AnnouncementTicker() {
  const message = "Loan facility is also available here.  •  Loan facility is also available here.  •  Loan facility is also available here.  •  Loan facility is also available here.";
  return (
    <div className="ticker-container py-2" data-testid="announcement-ticker">
      <div className="ticker-track text-sm text-[#F4D06F] font-medium">
        {message}
      </div>
    </div>
  );
}
