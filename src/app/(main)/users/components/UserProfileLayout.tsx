interface Props {
  username: string;
  type: "agent" | "user";
}

export function UserProfileLayout({ username, type }: Props) {
  return (
    <div className="space-y-6">
      {/* <UserHeader username={username} type={type} />
      <UserTabs type={type} /> */}
    </div>
  );
}
