require 'csv'
require 'selenium-webdriver'
require 'net/http'
require 'json'

options = Selenium::WebDriver::Chrome::Options.new
options.add_argument('--headless') # Adding the headless argument to Chrome
options.add_argument('--disable-gpu') # This is to disable GPU acceleration which is not needed in headless mode
options.add_argument('--window-size=1920,1080') # Specify a window size in case the website requires a certain size

api_key = "0472de5f-7468-47d7-a505-08c38b23bf03_0q2cgzu"

# Prompt user for CSV file path
puts "Please enter the path to your CSV file:"
csv_path = gets.chomp
csv_path = csv_path.gsub(/\"/, '') # Remove double quotes from the path

# Extract email addresses and passwords from the CSV
emails_passwords = []
CSV.foreach(csv_path, headers: true) do |row|
  emails_passwords << { email: row['EmailAddress'], password: row['Password'] }
end

puts "Number of email addresses in the CSV: #{emails_passwords.length}"

# Ask for confirmation
loop do
  print "Do you want to continue with the process? (y/n): "
  response = gets.chomp.downcase

  case response
  when 'y'
    break
  when 'n'
    exit
  else
    puts "Wrong input! Please try again."
  end
end

# Prompt user for custom Microsoft login page URL
print "Please enter the custom Microsoft login page URL: "
custom_login_url = gets.chomp

def fetch_existing_email_accounts(api_key)
  uri = URI("https://server.smartlead.ai/api/v1/email-accounts")
  params = { 'api_key' => api_key }
  uri.query = URI.encode_www_form(params)

  response = Net::HTTP.get_response(uri)
  
  if response.is_a?(Net::HTTPSuccess)
    accounts = JSON.parse(response.body)
    accounts.map { |account| account["from_email"] }
  else
    raise "Failed to fetch existing email accounts: #{response.message}"
  end
end


existing_emails = fetch_existing_email_accounts(api_key)

# Filter out existing emails from the batch to be added
emails_to_add = emails_passwords.reject do |account|
  already_exists = existing_emails.include?(account[:email])
  puts "Email account already exists. Skipping... #{account[:email]}" if already_exists
  already_exists # This will reject the email if it returns true
end


begin
  emails_to_add.each do |record|
    email = record[:email]
    password = record[:password]
    # print email to the console
    puts "Adding new account: #{email}" # Log the email being added
    driver = Selenium::WebDriver.for :chrome, options: options
    driver.navigate.to custom_login_url

    sleep 2

    oauth_username = email
    oauth_username_field = driver.find_element(name: 'loginfmt')
    oauth_username_field.send_keys(oauth_username)
    usnme_button = driver.find_element(css: 'input[type="submit"]')
    usnme_button.click

    sleep 2

    oauth_password = password
    oauth_password_field = driver.find_element(name: 'passwd')
    oauth_password_field.send_keys(oauth_password)
    pss_button = driver.find_element(css: 'input[type="submit"]')
    pss_button.click

    sleep 2

    accept_submit = driver.find_element(css: 'input[type="submit"]')
    accept_submit.click

    driver.quit
  end
rescue => exception
  p exception
end